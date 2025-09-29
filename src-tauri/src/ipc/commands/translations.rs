use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use uuid::Uuid;

use crate::db::{DbManager, NewTranslationRecord, PersistedTranslationOutput};
use crate::ipc::dto::{
    JobAccepted, TranslationCompletedPayload, TranslationFailedPayload, TranslationHistoryRecord,
    TranslationProgressPayload, TranslationRequest, TranslationStage,
};
use crate::ipc::error::{IpcError, IpcResult};
use crate::ipc::events::{TRANSLATION_COMPLETED, TRANSLATION_FAILED, TRANSLATION_PROGRESS};
use crate::ipc::state::{JobRecord, TranslationState};

const MAX_LANGUAGE_LENGTH: usize = 64;
const MAX_TEXT_LENGTH: usize = 20_000;

/// Returns a snapshot of all jobs that are currently tracked in-memory. The UI
/// uses this endpoint to restore job state after a renderer reload.
#[tauri::command]
pub async fn list_active_jobs(state: State<'_, TranslationState>) -> IpcResult<Vec<JobRecord>> {
    Ok(state.snapshot())
}

/// Enqueues a translation request and spawns an async task that simulates the
/// translation pipeline. The fake pipeline showcases the progress reporting
/// wiring we will later reuse with the real LLM backend.
#[tauri::command]
pub async fn start_translation(
    app: AppHandle,
    state: State<'_, TranslationState>,
    db: State<'_, DbManager>,
    mut request: TranslationRequest,
) -> IpcResult<JobAccepted> {
    request.source_language = request.source_language.trim().to_string();
    request.target_language = request.target_language.trim().to_string();
    request.text = request.text.trim().to_string();

    if request.source_language.is_empty() {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because source language is empty"
        );
        return Err(IpcError::Validation("source language is required".into()).into());
    }

    if request.target_language.is_empty() {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because target language is empty"
        );
        return Err(IpcError::Validation("target language is required".into()).into());
    }

    if request.source_language.len() > MAX_LANGUAGE_LENGTH {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because source language exceeds limit ({})",
            request.source_language
        );
        return Err(IpcError::Validation(format!(
            "source language must be {MAX_LANGUAGE_LENGTH} characters or fewer"
        ))
        .into());
    }

    if request.target_language.len() > MAX_LANGUAGE_LENGTH {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because target language exceeds limit ({})",
            request.target_language
        );
        return Err(IpcError::Validation(format!(
            "target language must be {MAX_LANGUAGE_LENGTH} characters or fewer"
        ))
        .into());
    }

    if request.text.is_empty() {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because text is empty"
        );
        return Err(IpcError::Validation("text is required".into()).into());
    }

    if request.source_language == request.target_language {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because languages match: {}",
            request.source_language
        );
        return Err(IpcError::Validation("source and target languages must differ".into()).into());
    }

    if request.text.len() > MAX_TEXT_LENGTH {
        warn!(
            target: "ipc::commands::translation",
            "Rejected translation request because text exceeds limit: {} characters",
            request.text.len()
        );
        return Err(IpcError::Validation(format!(
            "text must be {MAX_TEXT_LENGTH} characters or fewer"
        ))
        .into());
    }

    let job_id = Uuid::new_v4();
    info!(
        target: "ipc::commands::translation",
        "Accepted translation job {job_id} ({} -> {})",
        request.source_language,
        request.target_language
    );
    let new_record = NewTranslationRecord {
        job_id,
        request: request.clone(),
    };
    db.insert_job(&new_record).await?;
    state.track_job(job_id, request.clone());

    let accepted = JobAccepted {
        job_id,
        queued: true,
    };

    // Clone the shared state so the background task can keep reporting
    // progress even after this handler returns.
    let state_for_task = state.inner().clone();
    let request_for_task = request;
    let app_handle = app.clone();
    let db_for_task = db.inner().clone();

    spawn(async move {
        let start = Instant::now();

        let steps = [
            (
                TranslationStage::Preparing,
                0.2,
                "preparing request context",
            ),
            (TranslationStage::Translating, 0.7, "translating content"),
        ];

        for (stage, progress, message) in steps.into_iter() {
            let percent = progress * 100.0;
            debug!(
                target: "ipc::commands::translation",
                "job {job_id} advanced to {stage:?} ({percent:.0}%)"
            );
            state_for_task.record_progress(job_id, stage.clone(), progress);
            if let Err(err) = db_for_task
                .update_progress(job_id, stage.clone(), progress)
                .await
            {
                error!(
                    target: "ipc::commands::translation",
                    "failed to persist progress for {job_id}: {err}"
                );
            }
            let payload = TranslationProgressPayload {
                job_id,
                progress,
                stage: stage.clone(),
                message: Some(message.to_string()),
            };

            if let Err(err) = app_handle.emit(TRANSLATION_PROGRESS, payload) {
                error!(
                    target: "ipc::commands::translation",
                    "failed to emit translation progress for {job_id}: {err}"
                );
            }

            sleep(Duration::from_millis(200)).await;
        }

        // Simulate the generated translation output. In a real implementation
        // this is where you would call into your translation engine / LLM.
        let output_text = format!(
            "[{}→{}] {}",
            request_for_task.source_language.to_uppercase(),
            request_for_task.target_language.to_uppercase(),
            request_for_task.text
        );

        state_for_task.record_progress(job_id, TranslationStage::Completed, 1.0);
        state_for_task.finish_job(job_id);

        let completion = TranslationCompletedPayload {
            job_id,
            output_text,
            duration_ms: start.elapsed().as_millis(),
        };

        let duration_ms_i64 = completion.duration_ms.min(i64::MAX as u128) as i64;

        if let Err(err) = db_for_task
            .store_output(&PersistedTranslationOutput {
                job_id,
                output_text: completion.output_text.clone(),
                model_name: Some("demo-llm".to_string()),
                input_token_count: None,
                output_token_count: None,
                total_token_count: None,
                duration_ms: Some(duration_ms_i64),
            })
            .await
        {
            error!(
                target: "ipc::commands::translation",
                "failed to persist completion for {job_id}: {err}"
            );
        }

        info!(
            target: "ipc::commands::translation",
            "job {job_id} completed in {}ms",
            completion.duration_ms
        );
        if let Err(err) = app_handle.emit(TRANSLATION_COMPLETED, completion) {
            error!(
                target: "ipc::commands::translation",
                "failed to emit completion for {job_id}: {err}"
            );
        }
    });

    Ok(accepted)
}

/// Marks an in-flight translation job as failed and notifies the renderer so it
/// can surface the error to the user.
#[tauri::command]
pub async fn fail_translation(
    app: AppHandle,
    state: State<'_, TranslationState>,
    db: State<'_, DbManager>,
    job_id: Uuid,
    reason: Option<String>,
) -> IpcResult<()> {
    let reason = reason.unwrap_or_else(|| "unknown error".to_string());
    warn!(
        target: "ipc::commands::translation",
        "Marking translation job {job_id} as failed: {reason}"
    );
    state.finish_job(job_id);

    if let Err(err) = db.mark_failed(job_id, &reason).await {
        error!(
            target: "ipc::commands::translation",
            "failed to persist failure for {job_id}: {err}"
        );
    }

    let payload = TranslationFailedPayload { job_id, reason };

    if let Err(err) = app.emit(TRANSLATION_FAILED, payload) {
        error!(
            target: "ipc::commands::translation",
            "failed to emit failure event for {job_id}: {err}"
        );
    }

    Ok(())
}

/// Provides paginated access to stored translation history, enabling the UI to
/// power a searchable job log.
#[tauri::command]
pub async fn list_translation_history(
    db: State<'_, DbManager>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> IpcResult<Vec<TranslationHistoryRecord>> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    let records = db.list_history(limit, offset).await?;
    Ok(records)
}

/// Removes every stored translation record from the database and returns the
/// number of deleted rows for additional confirmation in the UI.
#[tauri::command]
pub async fn clear_translation_history(db: State<'_, DbManager>) -> IpcResult<u64> {
    let deleted = db.clear_history().await?;
    Ok(deleted)
}

/// Fetches a single translation record by identifier, including its persisted
/// output snapshot if available.
#[tauri::command]
pub async fn get_translation_job(
    db: State<'_, DbManager>,
    job_id: Uuid,
) -> IpcResult<Option<TranslationHistoryRecord>> {
    let record = db.get_job(job_id).await?;
    Ok(record)
}

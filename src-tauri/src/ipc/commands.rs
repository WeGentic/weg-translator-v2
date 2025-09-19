use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use uuid::Uuid;

use super::dto::{
    AppHealthReport, JobAccepted, TranslationCompletedPayload, TranslationFailedPayload,
    TranslationProgressPayload, TranslationRequest, TranslationStage,
};
use super::error::{IpcError, IpcResult};
use super::events::{TRANSLATION_COMPLETED, TRANSLATION_FAILED, TRANSLATION_PROGRESS};
use super::state::{JobRecord, TranslationState};

#[tauri::command]
pub async fn health_check() -> AppHealthReport {
    debug!(target: "ipc::commands::health", "health_check requested");
    AppHealthReport {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
    }
}

#[tauri::command]
pub async fn list_active_jobs(state: State<'_, TranslationState>) -> IpcResult<Vec<JobRecord>> {
    Ok(state.snapshot())
}

#[tauri::command]
pub async fn start_translation(
    app: AppHandle,
    state: State<'_, TranslationState>,
    request: TranslationRequest,
) -> IpcResult<JobAccepted> {
    if request.text.trim().is_empty() {
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
        return Err(
            IpcError::Validation("source and target languages must differ".into()).into(),
        );
    }

    let job_id = Uuid::new_v4();
    info!(
        target: "ipc::commands::translation",
        "Accepted translation job {job_id} ({} -> {})",
        request.source_language,
        request.target_language
    );
    state.track_job(job_id, request.clone());

    let accepted = JobAccepted {
        job_id,
        queued: true,
    };

    let state_for_task = state.inner().clone();
    let request_for_task = request;
    let app_handle = app.clone();

    spawn(async move {
        let start = Instant::now();

        let steps = [
            (TranslationStage::Preparing, 0.2, "preparing request context"),
            (TranslationStage::Translating, 0.7, "translating content"),
        ];

        for (stage, progress, message) in steps.into_iter() {
            let percent = progress * 100.0;
            debug!(
                target: "ipc::commands::translation",
                "job {job_id} advanced to {stage:?} ({percent:.0}%)"
            );
            state_for_task.record_progress(job_id, stage.clone(), progress);
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

#[tauri::command]
pub async fn fail_translation(
    app: AppHandle,
    state: State<'_, TranslationState>,
    job_id: Uuid,
    reason: Option<String>,
) -> IpcResult<()> {
    let reason = reason.unwrap_or_else(|| "unknown error".to_string());
    warn!(
        target: "ipc::commands::translation",
        "Marking translation job {job_id} as failed: {reason}"
    );
    state.finish_job(job_id);

    let payload = TranslationFailedPayload { job_id, reason };

    if let Err(err) = app.emit(TRANSLATION_FAILED, payload) {
        error!(
            target: "ipc::commands::translation",
            "failed to emit failure event for {job_id}: {err}"
        );
    }

    Ok(())
}

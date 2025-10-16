//! TODO: Translation pipeline temporarily disabled.
//!
//! The legacy simulation queried tables removed by the v2 schema. These
//! command handlers now short-circuit so the application can start without
//! hitting missing-table panics. Once the new translation workflow is ready,
//! re-implement the logic here against the updated database layout.

use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::ipc::dto::{JobAccepted, TranslationHistoryRecord};
use crate::ipc::error::{IpcError, IpcResult};
use crate::ipc::state::JobRecord;

#[tauri::command]
pub async fn list_active_jobs(
    _state: State<'_, crate::ipc::state::TranslationState>,
) -> IpcResult<Vec<JobRecord>> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn start_translation(
    _app: AppHandle,
    _state: State<'_, crate::ipc::state::TranslationState>,
    _db: State<'_, crate::db::DbManager>,
    _request: crate::ipc::dto::TranslationRequest,
) -> IpcResult<JobAccepted> {
    Err(IpcError::Internal(
        "Translation pipeline is not yet implemented for the new schema.".into(),
    )
    .into())
}

#[tauri::command]
pub async fn fail_translation(
    _app: AppHandle,
    _state: State<'_, crate::ipc::state::TranslationState>,
    _db: State<'_, crate::db::DbManager>,
    _job_id: Uuid,
    _reason: Option<String>,
) -> IpcResult<()> {
    Ok(())
}

#[tauri::command]
pub async fn list_translation_history(
    _db: State<'_, crate::db::DbManager>,
    _limit: Option<i64>,
    _offset: Option<i64>,
) -> IpcResult<Vec<TranslationHistoryRecord>> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn clear_translation_history(_db: State<'_, crate::db::DbManager>) -> IpcResult<u64> {
    Ok(0)
}

#[tauri::command]
pub async fn get_translation_job(
    _db: State<'_, crate::db::DbManager>,
    _job_id: Uuid,
) -> IpcResult<Option<TranslationHistoryRecord>> {
    Ok(None)
}

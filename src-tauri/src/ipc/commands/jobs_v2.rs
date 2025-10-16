use tauri::State;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{JobRecord, NewJobArgs, UpdateJobStatusArgs};
use crate::ipc::dto::{JobV2Dto, UpdateJobStatusPayload, UpsertJobPayload};
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn upsert_job_record_v2(
    db: State<'_, DbManager>,
    payload: UpsertJobPayload,
) -> IpcResult<JobV2Dto> {
    let args = map_new_job_args(payload)?;
    let record = db.upsert_job_record(args).await.map_err(IpcError::from)?;
    Ok(map_job_record(record))
}

#[tauri::command]
pub async fn update_job_status_v2(
    db: State<'_, DbManager>,
    payload: UpdateJobStatusPayload,
) -> IpcResult<Option<JobV2Dto>> {
    let args = map_update_job_status_args(payload)?;
    let record = db
        .update_job_status_record(args)
        .await
        .map_err(IpcError::from)?;
    Ok(record.map(map_job_record))
}

#[tauri::command]
pub async fn delete_job_record_v2(
    db: State<'_, DbManager>,
    artifact_uuid: String,
    job_type: String,
) -> IpcResult<()> {
    let artifact_uuid = parse_uuid(&artifact_uuid, "artifactUuid")?;
    db.delete_job_record(artifact_uuid, &job_type)
        .await
        .map_err(IpcError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn list_jobs_for_project_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
) -> IpcResult<Vec<JobV2Dto>> {
    let project_uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let jobs = db
        .list_jobs_for_project(project_uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(jobs.into_iter().map(map_job_record).collect())
}

fn map_new_job_args(payload: UpsertJobPayload) -> Result<NewJobArgs, IpcError> {
    let artifact_uuid = parse_uuid(&payload.artifact_uuid, "artifactUuid")?;
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    Ok(NewJobArgs {
        artifact_uuid,
        job_type: payload.job_type,
        project_uuid,
        job_status: payload.job_status,
        error_log: payload.error_log,
    })
}

fn map_update_job_status_args(
    payload: UpdateJobStatusPayload,
) -> Result<UpdateJobStatusArgs, IpcError> {
    let artifact_uuid = parse_uuid(&payload.artifact_uuid, "artifactUuid")?;
    Ok(UpdateJobStatusArgs {
        artifact_uuid,
        job_type: payload.job_type,
        job_status: payload.job_status,
        error_log: payload.error_log,
    })
}

fn map_job_record(record: JobRecord) -> JobV2Dto {
    JobV2Dto {
        artifact_uuid: record.artifact_uuid.to_string(),
        job_type: record.job_type,
        project_uuid: record.project_uuid.to_string(),
        job_status: record.job_status,
        error_log: record.error_log,
    }
}

fn parse_uuid(value: &str, field: &str) -> Result<Uuid, IpcError> {
    Uuid::parse_str(value)
        .map_err(|_| IpcError::Validation(format!("invalid {field}: expected UUID, got '{value}'")))
}

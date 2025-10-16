use tauri::State;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{ArtifactRecord, NewArtifactArgs, UpdateArtifactStatusArgs};
use crate::ipc::dto::{ArtifactV2Dto, UpdateArtifactStatusPayload, UpsertArtifactPayload};
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn upsert_artifact_record_v2(
    db: State<'_, DbManager>,
    payload: UpsertArtifactPayload,
) -> IpcResult<ArtifactV2Dto> {
    let args = map_new_artifact_args(payload)?;
    let record = db
        .upsert_artifact_record(args)
        .await
        .map_err(IpcError::from)?;
    Ok(map_artifact_record(record))
}

#[tauri::command]
pub async fn update_artifact_status_v2(
    db: State<'_, DbManager>,
    payload: UpdateArtifactStatusPayload,
) -> IpcResult<Option<ArtifactV2Dto>> {
    let args = map_update_artifact_status_args(payload)?;
    let record = db
        .update_artifact_status(args)
        .await
        .map_err(IpcError::from)?;
    Ok(record.map(map_artifact_record))
}

#[tauri::command]
pub async fn delete_artifact_record_v2(
    db: State<'_, DbManager>,
    artifact_uuid: String,
) -> IpcResult<()> {
    let artifact_uuid = parse_uuid(&artifact_uuid, "artifactUuid")?;
    db.delete_artifact_record(artifact_uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn list_artifacts_for_file_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
    file_uuid: String,
) -> IpcResult<Vec<ArtifactV2Dto>> {
    let project_uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let file_uuid = parse_uuid(&file_uuid, "fileUuid")?;
    let artifacts = db
        .list_artifacts_for_file(project_uuid, file_uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(artifacts.into_iter().map(map_artifact_record).collect())
}

fn map_new_artifact_args(payload: UpsertArtifactPayload) -> Result<NewArtifactArgs, IpcError> {
    let artifact_uuid = payload
        .artifact_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "artifactUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    let file_uuid = parse_uuid(&payload.file_uuid, "fileUuid")?;

    Ok(NewArtifactArgs {
        artifact_uuid,
        project_uuid,
        file_uuid,
        artifact_type: payload.artifact_type,
        size_bytes: payload.size_bytes,
        segment_count: payload.segment_count,
        token_count: payload.token_count,
        status: payload.status,
    })
}

fn map_update_artifact_status_args(
    payload: UpdateArtifactStatusPayload,
) -> Result<UpdateArtifactStatusArgs, IpcError> {
    let artifact_uuid = parse_uuid(&payload.artifact_uuid, "artifactUuid")?;
    Ok(UpdateArtifactStatusArgs {
        artifact_uuid,
        status: payload.status,
        size_bytes: payload.size_bytes,
        segment_count: payload.segment_count,
        token_count: payload.token_count,
    })
}

fn map_artifact_record(record: ArtifactRecord) -> ArtifactV2Dto {
    ArtifactV2Dto {
        artifact_uuid: record.artifact_uuid.to_string(),
        project_uuid: record.project_uuid.to_string(),
        file_uuid: record.file_uuid.to_string(),
        artifact_type: record.artifact_type,
        size_bytes: record.size_bytes,
        segment_count: record.segment_count,
        token_count: record.token_count,
        status: record.status,
    }
}

fn parse_uuid(value: &str, field: &str) -> Result<Uuid, IpcError> {
    Uuid::parse_str(value)
        .map_err(|_| IpcError::Validation(format!("invalid {field}: expected UUID, got '{value}'")))
}

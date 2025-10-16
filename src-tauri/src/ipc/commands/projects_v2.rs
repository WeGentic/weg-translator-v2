use tauri::State;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{
    FileInfoRecord, FileLanguagePairInput, NewFileInfoArgs, NewProjectArgs, NewProjectFileArgs,
    ProjectBundle, ProjectFileBundle, ProjectLanguagePairInput, ProjectRecord, ProjectSubjectInput,
    UpdateProjectArgs,
};
use crate::ipc::dto::{
    ArtifactV2Dto, AttachProjectFilePayload, CreateProjectPayload, FileInfoV2Dto,
    FileLanguagePairDto, JobV2Dto, ProjectBundleV2Dto, ProjectFileBundleV2Dto, ProjectFileLinkDto,
    ProjectLanguagePairDto, ProjectRecordV2Dto, UpdateProjectPayload,
};
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn create_project_bundle_v2(
    db: State<'_, DbManager>,
    payload: CreateProjectPayload,
) -> IpcResult<ProjectBundleV2Dto> {
    let args = map_new_project_args(payload)?;
    let bundle = db
        .create_project_bundle(args)
        .await
        .map_err(IpcError::from)?;
    Ok(map_project_bundle(bundle))
}

#[tauri::command]
pub async fn update_project_bundle_v2(
    db: State<'_, DbManager>,
    payload: UpdateProjectPayload,
) -> IpcResult<Option<ProjectBundleV2Dto>> {
    let args = map_update_project_args(payload)?;
    let bundle = db
        .update_project_bundle(args)
        .await
        .map_err(IpcError::from)?;
    Ok(bundle.map(map_project_bundle))
}

#[tauri::command]
pub async fn delete_project_bundle_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
) -> IpcResult<()> {
    let uuid = parse_uuid(&project_uuid, "projectUuid")?;
    db.delete_project_bundle(uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn get_project_bundle_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
) -> IpcResult<Option<ProjectBundleV2Dto>> {
    let uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let bundle = db.get_project_bundle(uuid).await.map_err(IpcError::from)?;
    Ok(bundle.map(map_project_bundle))
}

#[tauri::command]
pub async fn list_project_records_v2(
    db: State<'_, DbManager>,
) -> IpcResult<Vec<ProjectRecordV2Dto>> {
    let records = db.list_project_records().await.map_err(IpcError::from)?;
    Ok(records.into_iter().map(map_project_record).collect())
}

#[tauri::command]
pub async fn attach_project_file_v2(
    db: State<'_, DbManager>,
    payload: AttachProjectFilePayload,
) -> IpcResult<ProjectFileBundleV2Dto> {
    let file_info = map_new_file_info_args(&payload)?;
    let link_args = map_new_project_file_args(&payload)?;
    let bundle = db
        .attach_project_file(file_info, link_args)
        .await
        .map_err(IpcError::from)?;
    Ok(map_project_file_bundle(bundle))
}

#[tauri::command]
pub async fn detach_project_file_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
    file_uuid: String,
) -> IpcResult<()> {
    let project_uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let file_uuid = parse_uuid(&file_uuid, "fileUuid")?;
    db.detach_project_file(project_uuid, file_uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(())
}

fn map_new_project_args(payload: CreateProjectPayload) -> Result<NewProjectArgs, IpcError> {
    if payload.language_pairs.is_empty() {
        return Err(IpcError::Validation(
            "project must include at least one language pair".into(),
        ));
    }

    let project_uuid = payload
        .project_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "projectUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);

    let user_uuid = payload
        .user_uuid
        .as_deref()
        .ok_or_else(|| IpcError::Validation("userUuid is required".into()))
        .and_then(|value| parse_uuid(value, "userUuid"))?;

    let client_uuid = payload
        .client_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "clientUuid"))
        .transpose()?;

    Ok(NewProjectArgs {
        project_uuid,
        project_name: payload.project_name,
        project_status: payload.project_status,
        user_uuid,
        client_uuid,
        r#type: payload.r#type,
        notes: payload.notes,
        subjects: payload
            .subjects
            .into_iter()
            .map(|subject| ProjectSubjectInput { subject })
            .collect(),
        language_pairs: payload
            .language_pairs
            .into_iter()
            .map(map_project_language_pair_input)
            .collect(),
    })
}

fn map_update_project_args(payload: UpdateProjectPayload) -> Result<UpdateProjectArgs, IpcError> {
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    let language_pairs = payload.language_pairs.map(|pairs| {
        pairs
            .into_iter()
            .map(map_project_language_pair_input)
            .collect::<Vec<_>>()
    });

    if let Some(ref pairs) = language_pairs {
        if pairs.is_empty() {
            return Err(IpcError::Validation(
                "languagePairs must include at least one entry".into(),
            ));
        }
    }

    let user_uuid = payload
        .user_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "userUuid"))
        .transpose()?;

    let client_uuid = match payload.client_uuid {
        Some(Some(value)) => Some(Some(parse_uuid(&value, "clientUuid")?)),
        Some(None) => Some(None),
        None => None,
    };

    let subjects = payload.subjects.map(|list| {
        list.into_iter()
            .map(|subject| ProjectSubjectInput { subject })
            .collect()
    });

    Ok(UpdateProjectArgs {
        project_uuid,
        project_name: payload.project_name,
        project_status: payload.project_status,
        user_uuid,
        client_uuid,
        r#type: payload.r#type,
        notes: payload.notes,
        subjects,
        language_pairs,
    })
}

fn map_new_file_info_args(payload: &AttachProjectFilePayload) -> Result<NewFileInfoArgs, IpcError> {
    let file_uuid = payload
        .file_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "fileUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);

    Ok(NewFileInfoArgs {
        file_uuid,
        ext: payload.ext.clone(),
        r#type: payload.r#type.clone(),
        size_bytes: payload.size_bytes,
        segment_count: payload.segment_count,
        token_count: payload.token_count,
        notes: payload.notes.clone(),
    })
}

fn map_new_project_file_args(
    payload: &AttachProjectFilePayload,
) -> Result<NewProjectFileArgs, IpcError> {
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    let file_uuid = payload
        .file_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "fileUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);

    if payload.language_pairs.is_empty() {
        return Err(IpcError::Validation(
            "languagePairs must include at least one entry".into(),
        ));
    }

    Ok(NewProjectFileArgs {
        project_uuid,
        file_uuid,
        filename: payload.filename.clone(),
        stored_at: payload.stored_at.clone(),
        r#type: payload.r#type.clone(),
        language_pairs: payload
            .language_pairs
            .iter()
            .cloned()
            .map(map_file_language_pair_input)
            .collect(),
    })
}

fn map_project_bundle(bundle: ProjectBundle) -> ProjectBundleV2Dto {
    ProjectBundleV2Dto {
        project: map_project_record(bundle.project),
        subjects: bundle
            .subjects
            .into_iter()
            .map(|subject| subject.subject)
            .collect(),
        language_pairs: bundle
            .language_pairs
            .into_iter()
            .map(map_project_language_pair_record)
            .collect(),
        files: bundle
            .files
            .into_iter()
            .map(map_project_file_bundle)
            .collect(),
        jobs: bundle.jobs.into_iter().map(map_job_record).collect(),
    }
}

fn map_project_record(record: ProjectRecord) -> ProjectRecordV2Dto {
    ProjectRecordV2Dto {
        project_uuid: record.project_uuid.to_string(),
        project_name: record.project_name,
        creation_date: record.creation_date,
        update_date: record.update_date,
        project_status: record.project_status,
        user_uuid: record.user_uuid.to_string(),
        client_uuid: record.client_uuid.map(|id| id.to_string()),
        r#type: record.r#type,
        notes: record.notes,
    }
}

fn map_project_file_bundle(bundle: ProjectFileBundle) -> ProjectFileBundleV2Dto {
    ProjectFileBundleV2Dto {
        file: map_project_file_record(bundle.link),
        info: map_file_info_record(bundle.info),
        language_pairs: bundle
            .language_pairs
            .into_iter()
            .map(map_file_language_pair_record)
            .collect(),
        artifacts: bundle
            .artifacts
            .into_iter()
            .map(map_artifact_record)
            .collect(),
    }
}

fn map_project_file_record(record: crate::db::types::ProjectFileRecord) -> ProjectFileLinkDto {
    ProjectFileLinkDto {
        project_uuid: record.project_uuid.to_string(),
        file_uuid: record.file_uuid.to_string(),
        filename: record.filename,
        stored_at: record.stored_at,
        r#type: record.r#type,
    }
}

fn map_file_info_record(record: FileInfoRecord) -> FileInfoV2Dto {
    FileInfoV2Dto {
        file_uuid: record.file_uuid.to_string(),
        ext: record.ext,
        r#type: record.r#type,
        size_bytes: record.size_bytes,
        segment_count: record.segment_count,
        token_count: record.token_count,
        notes: record.notes,
    }
}

fn map_project_language_pair_input(dto: ProjectLanguagePairDto) -> ProjectLanguagePairInput {
    ProjectLanguagePairInput {
        source_lang: dto.source_lang,
        target_lang: dto.target_lang,
    }
}

fn map_project_language_pair_record(
    record: crate::db::types::ProjectLanguagePairRecord,
) -> ProjectLanguagePairDto {
    ProjectLanguagePairDto {
        source_lang: record.source_lang,
        target_lang: record.target_lang,
    }
}

fn map_file_language_pair_input(dto: FileLanguagePairDto) -> FileLanguagePairInput {
    FileLanguagePairInput {
        source_lang: dto.source_lang,
        target_lang: dto.target_lang,
    }
}

fn map_file_language_pair_record(
    record: crate::db::types::FileLanguagePairRecord,
) -> FileLanguagePairDto {
    FileLanguagePairDto {
        source_lang: record.source_lang,
        target_lang: record.target_lang,
    }
}

fn map_artifact_record(record: crate::db::types::ArtifactRecord) -> ArtifactV2Dto {
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

fn map_job_record(record: crate::db::types::JobRecord) -> JobV2Dto {
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

use serde_json::json;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::ipc::InvokeError;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::task;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{
    FileInfoRecord, FileLanguagePairInput, NewArtifactArgs, NewFileInfoArgs, NewJobArgs,
    NewProjectArgs, NewProjectFileArgs, ProjectBundle, ProjectConversionStats, ProjectFileBundle,
    ProjectFileTotals, ProjectJobStats, ProjectLanguagePairInput, ProjectListRecord,
    ProjectProgressStats, ProjectRecord, ProjectStatistics, ProjectSubjectInput,
    ProjectWarningStats, UpdateArtifactStatusArgs, UpdateProjectArgs,
};
use crate::ipc::dto::{
    ArtifactV2Dto, AttachProjectFilePayload, ConversionPlanDto, ConversionTaskDto,
    ConvertXliffToJliffPayload, CreateProjectPayload, CreateProjectWithAssetsPayload,
    CreateProjectWithAssetsResponseDto, EnsureConversionPlanPayload, FileInfoV2Dto,
    FileIntegrityAlertDto, FileLanguagePairDto, JliffConversionResultDto, JobV2Dto,
    ProjectAssetDescriptorDto, ProjectAssetResultDto, ProjectAssetRoleDto, ProjectBundleV2Dto,
    ProjectConversionStatsDto, ProjectFileBundleV2Dto, ProjectFileLinkDto, ProjectFileTotalsDto,
    ProjectJobStatsDto, ProjectLanguagePairDto, ProjectProgressStatsDto, ProjectRecordV2Dto,
    ProjectStatisticsDto, ProjectWarningStatsDto, UpdateConversionStatusPayload,
    UpdateProjectPayload,
};
use crate::ipc::error::{IpcError, IpcResult};
use crate::ipc::events::{PROJECT_CREATE_COMPLETE, PROJECT_CREATE_PROGRESS};
use crate::jliff::{ConversionOptions, convert_xliff};
use crate::settings::SettingsManager;

#[tauri::command]
pub async fn create_project_with_assets_v2(
    app: AppHandle,
    db: State<'_, DbManager>,
    settings: State<'_, SettingsManager>,
    payload: CreateProjectWithAssetsPayload,
) -> IpcResult<CreateProjectWithAssetsResponseDto> {
    create_project_with_assets_impl(app, db.inner(), settings.inner(), payload).await
}

pub async fn create_project_with_assets_impl<R: Runtime>(
    app: AppHandle<R>,
    db: &DbManager,
    settings: &SettingsManager,
    payload: CreateProjectWithAssetsPayload,
) -> IpcResult<CreateProjectWithAssetsResponseDto> {
    log::info!(
        target: "ipc::projects_v2",
        "create_project_with_assets_v2 invoked for project '{}'",
        payload.project_name
    );

    let folder_name = validate_project_folder_name(&payload.project_folder_name)?;
    emit_progress_event(
        &app,
        folder_name,
        None,
        "validating-input",
        Some("Validating project details."),
    );

    let settings_snapshot = settings.current().await;
    let projects_root = settings_snapshot.projects_dir();
    let destination = projects_root.join(folder_name);

    ensure_destination_available(destination.clone(), folder_name).await?;
    emit_progress_event(
        &app,
        folder_name,
        None,
        "preparing-folders",
        Some("Preparing project directories on disk."),
    );
    let scaffold_guard = create_project_scaffold(destination.clone()).await?;

    emit_progress_event(
        &app,
        folder_name,
        None,
        "creating-project-record",
        Some("Saving project metadata."),
    );

    let project_args = map_new_project_args_from_assets_payload(&payload)?;
    let project_bundle = db
        .create_project_bundle(project_args)
        .await
        .map_err(IpcError::from)?;

    let project_uuid = project_bundle.project.project_uuid;

    emit_progress_event(
        &app,
        folder_name,
        Some(project_uuid),
        "copying-assets",
        Some("Copying project files."),
    );

    let copied_assets = match copy_project_assets(&destination, &payload.assets).await {
        Ok(assets) => assets,
        Err(error) => {
            rollback_project_creation(db, project_uuid).await;
            return Err(error);
        }
    };

    let file_cleanup_targets: Vec<PathBuf> = copied_assets
        .iter()
        .map(|asset| asset.absolute_path.clone())
        .collect();

    let mut attachment_error: Option<IpcError> = None;

    for asset in &copied_assets {
        let file_info = NewFileInfoArgs {
            file_uuid: asset.file_uuid,
            ext: asset.original_extension.clone(),
            r#type: map_asset_role_to_file_info_type(asset.role),
            size_bytes: asset.size_bytes,
            segment_count: None,
            token_count: None,
            notes: None,
        };

        let filename = Path::new(&asset.stored_rel_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&asset.stored_rel_path)
            .to_string();

        let project_file = NewProjectFileArgs {
            project_uuid,
            file_uuid: asset.file_uuid,
            filename,
            stored_at: asset.stored_rel_path.clone(),
            r#type: map_asset_role_to_project_file_type(asset.role),
            language_pairs: file_language_pairs_for_role(asset.role, &payload.language_pairs),
        };

        if let Err(error) = db
            .attach_project_file(file_info, project_file)
            .await
            .map_err(IpcError::from)
        {
            attachment_error = Some(error);
            break;
        }
    }

    if let Some(error) = attachment_error {
        cleanup_files(&file_cleanup_targets);
        rollback_project_creation(db, project_uuid).await;
        return Err(error.into());
    }

    emit_progress_event(
        &app,
        folder_name,
        Some(project_uuid),
        "registering-database",
        Some("Registering files in the database."),
    );

    emit_progress_event(
        &app,
        folder_name,
        Some(project_uuid),
        "planning-conversions",
        Some("Planning conversion jobs."),
    );

    let conversion_plan = match prepare_conversion_plan(
        db,
        project_uuid,
        &destination,
        &copied_assets,
        &payload.language_pairs,
    )
    .await
    {
        Ok(plan) => plan,
        Err(error) => {
            cleanup_files(&file_cleanup_targets);
            rollback_project_creation(db, project_uuid).await;
            return Err(error);
        }
    };

    let refreshed_bundle = match db.get_project_bundle(project_uuid).await {
        Ok(Some(bundle)) => bundle,
        Ok(None) => {
            cleanup_files(&file_cleanup_targets);
            rollback_project_creation(db, project_uuid).await;
            return Err(
                IpcError::Internal("Project bundle not found after attachments.".into()).into(),
            );
        }
        Err(error) => {
            cleanup_files(&file_cleanup_targets);
            rollback_project_creation(db, project_uuid).await;
            return Err(IpcError::from(error).into());
        }
    };

    let asset_results: Vec<ProjectAssetResultDto> = copied_assets
        .iter()
        .map(|asset| ProjectAssetResultDto {
            draft_id: asset.draft_id.clone(),
            file_uuid: Some(asset.file_uuid.to_string()),
            stored_rel_path: Some(asset.stored_rel_path.clone()),
            role: asset.role,
        })
        .collect();

    let response = CreateProjectWithAssetsResponseDto {
        project: map_project_bundle(refreshed_bundle),
        project_dir: destination.to_string_lossy().into_owned(),
        assets: asset_results,
        conversion_plan,
    };

    scaffold_guard.commit();

    let task_count = response
        .conversion_plan
        .as_ref()
        .map(|plan| plan.tasks.len())
        .unwrap_or(0);
    emit_completion_event(&app, folder_name, project_uuid, task_count);

    Ok(response)
}

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
pub async fn get_project_statistics_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
) -> IpcResult<Option<ProjectStatisticsDto>> {
    let uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let stats = db
        .get_project_statistics(uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(stats.map(map_project_statistics))
}

#[tauri::command]
pub async fn list_project_records_v2(
    db: State<'_, DbManager>,
) -> IpcResult<Vec<ProjectRecordV2Dto>> {
    let records = db.list_project_records().await.map_err(IpcError::from)?;
    Ok(records.into_iter().map(map_project_list_record).collect())
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

#[tauri::command]
pub async fn ensure_project_conversions_plan_v2(
    db: State<'_, DbManager>,
    settings: State<'_, SettingsManager>,
    payload: EnsureConversionPlanPayload,
) -> IpcResult<ConversionPlanDto> {
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    let filter_ids: Option<HashSet<Uuid>> = payload
        .file_uuids
        .as_ref()
        .map(|ids| {
            let mut parsed = HashSet::with_capacity(ids.len());
            for id in ids {
                let uuid = parse_uuid(id, "fileUuid")?;
                parsed.insert(uuid);
            }
            Ok::<_, IpcError>(parsed)
        })
        .transpose()?;

    let bundle = db
        .get_project_bundle(project_uuid)
        .await
        .map_err(IpcError::from)?
        .ok_or_else(|| IpcError::Validation(format!("Project '{}' not found", project_uuid)))?;

    let settings_snapshot = settings.current().await;
    let projects_root = settings_snapshot.projects_dir();
    let project_root = locate_project_root(&projects_root, project_uuid, &bundle).await?;
    let default_version = settings_snapshot.default_xliff_version.clone();

    let mut tasks: Vec<ConversionTaskDto> = Vec::new();
    let mut alerts: Vec<FileIntegrityAlertDto> = Vec::new();

    for file_bundle in &bundle.files {
        if !file_bundle.link.r#type.eq_ignore_ascii_case("processable") {
            continue;
        }

        if let Some(filters) = filter_ids.as_ref() {
            if !filters.contains(&file_bundle.link.file_uuid) {
                continue;
            }
        }

        let input_rel = Path::new(&file_bundle.link.stored_at);
        let input_abs = project_root.join(input_rel);

        if !input_abs.is_file() {
            alerts.push(FileIntegrityAlertDto {
                file_uuid: file_bundle.link.file_uuid.to_string(),
                file_name: file_bundle.link.filename.clone(),
                expected_hash: None,
                actual_hash: None,
            });
            continue;
        }

        let artifact_uuid =
            ensure_conversion_artifact(db.inner(), project_uuid, file_bundle.link.file_uuid)
                .await?;

        db.update_artifact_status(UpdateArtifactStatusArgs {
            artifact_uuid,
            status: "PENDING".into(),
            size_bytes: None,
            segment_count: None,
            token_count: None,
        })
        .await
        .map_err(IpcError::from)?;

        ensure_conversion_job(db.inner(), project_uuid, artifact_uuid, "pending", None).await?;

        let file_pairs: Vec<ProjectLanguagePairDto> = if !file_bundle.language_pairs.is_empty() {
            file_bundle
                .language_pairs
                .iter()
                .map(|pair| ProjectLanguagePairDto {
                    source_lang: pair.source_lang.clone(),
                    target_lang: pair.target_lang.clone(),
                })
                .collect()
        } else {
            bundle
                .language_pairs
                .iter()
                .map(|pair| ProjectLanguagePairDto {
                    source_lang: pair.source_lang.clone(),
                    target_lang: pair.target_lang.clone(),
                })
                .collect()
        };

        if file_pairs.is_empty() {
            alerts.push(FileIntegrityAlertDto {
                file_uuid: file_bundle.link.file_uuid.to_string(),
                file_name: file_bundle.link.filename.clone(),
                expected_hash: None,
                actual_hash: None,
            });
            continue;
        }

        let file_stem = Path::new(&file_bundle.link.filename)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(str::to_owned)
            .unwrap_or_else(|| "artifact".to_string());

        let source_path_str = input_abs.to_string_lossy().into_owned();

        for pair in file_pairs {
            let language_dir = language_pair_directory_name(&pair);
            let output_rel_path = Path::new("Translations")
                .join(&language_dir)
                .join(format!("{file_stem}.xlf"));
            let output_abs_path = project_root.join(&output_rel_path);

            if let Some(parent) = output_abs_path.parent() {
                if let Err(error) = tokio::fs::create_dir_all(parent).await {
                    return Err(IpcError::Internal(format!(
                        "Failed to prepare output directory '{}': {}",
                        parent.display(),
                        error
                    ))
                    .into());
                }
            }

            let output_rel_path_str = output_rel_path.to_string_lossy().into_owned();
            let output_abs_path_str = output_abs_path.to_string_lossy().into_owned();

            tasks.push(ConversionTaskDto {
                draft_id: file_bundle.link.file_uuid.to_string(),
                file_uuid: Some(file_bundle.link.file_uuid.to_string()),
                artifact_uuid: Some(artifact_uuid.to_string()),
                job_type: Some("xliff_conversion".into()),
                source_lang: pair.source_lang.clone(),
                target_lang: pair.target_lang.clone(),
                source_path: source_path_str.clone(),
                xliff_rel_path: output_rel_path_str,
                xliff_abs_path: Some(output_abs_path_str),
                version: Some(default_version.clone()),
                paragraph: Some(true),
                embed: Some(true),
            });
        }
    }

    Ok(ConversionPlanDto {
        project_uuid: project_uuid.to_string(),
        tasks,
        integrity_alerts: alerts,
    })
}

#[tauri::command]
pub async fn update_conversion_status_v2(
    db: State<'_, DbManager>,
    payload: UpdateConversionStatusPayload,
) -> IpcResult<ArtifactV2Dto> {
    let artifact_uuid = parse_uuid(&payload.artifact_uuid, "artifactUuid")?;
    let status_upper = payload.status.to_uppercase();
    let job_status = payload.status.to_lowercase();

    let updated = db
        .update_artifact_status(UpdateArtifactStatusArgs {
            artifact_uuid,
            status: status_upper,
            size_bytes: payload.size_bytes,
            segment_count: payload.segment_count,
            token_count: payload.token_count,
        })
        .await
        .map_err(IpcError::from)?
        .ok_or_else(|| IpcError::Validation("artifact not found for conversion update".into()))?;

    let error_log = if job_status == "failed" {
        payload.error_message.clone()
    } else {
        None
    };

    ensure_conversion_job(
        db.inner(),
        updated.project_uuid,
        artifact_uuid,
        &job_status,
        error_log,
    )
    .await?;

    Ok(map_artifact_record(updated))
}

#[tauri::command]
pub async fn convert_xliff_to_jliff_v2(
    db: State<'_, DbManager>,
    settings: State<'_, SettingsManager>,
    payload: ConvertXliffToJliffPayload,
) -> IpcResult<JliffConversionResultDto> {
    let project_uuid = parse_uuid(&payload.project_uuid, "projectUuid")?;
    let conversion_uuid = parse_uuid(&payload.conversion_id, "conversionId")?;
    let xliff_path = PathBuf::from(&payload.xliff_abs_path);
    let xliff_dir = xliff_path.parent().ok_or_else(|| {
        IpcError::Validation("xliffAbsPath must reference a file within a directory".into())
    })?;

    let bundle = db
        .get_project_bundle(project_uuid)
        .await
        .map_err(IpcError::from)?
        .ok_or_else(|| IpcError::Validation(format!("Project '{}' not found", project_uuid)))?;

    let settings_snapshot = settings.current().await;
    let projects_root = settings_snapshot.projects_dir();
    let project_root = locate_project_root(&projects_root, project_uuid, &bundle).await?;

    let mut options = ConversionOptions::new(
        xliff_path.clone(),
        xliff_dir.to_path_buf(),
        bundle.project.project_name.clone(),
        project_uuid.to_string(),
        payload
            .operator
            .clone()
            .unwrap_or_else(|| "operator".into()),
    );

    options.file_prefix = Some(conversion_uuid.to_string());

    if let Some(schema_path) = payload.schema_abs_path.as_ref() {
        options.schema_path = Some(PathBuf::from(schema_path));
    }

    let generated = convert_xliff(&options).map_err(|err| IpcError::Internal(err.to_string()))?;

    let primary = generated.into_iter().next().ok_or_else(|| {
        IpcError::Internal("No artifacts generated from XLIFF conversion.".into())
    })?;

    let jliff_abs_path = primary.jliff_path.to_string_lossy().into_owned();
    let tag_map_abs_path = primary.tag_map_path.to_string_lossy().into_owned();
    let jliff_rel_path = relative_to_project(&primary.jliff_path, &project_root)?;
    let tag_map_rel_path = relative_to_project(&primary.tag_map_path, &project_root)?;

    Ok(JliffConversionResultDto {
        file_id: primary.file_id,
        jliff_abs_path,
        jliff_rel_path,
        tag_map_abs_path,
        tag_map_rel_path,
    })
}

#[tauri::command]
pub async fn update_project_file_role_v2(
    db: State<'_, DbManager>,
    project_uuid: String,
    file_uuid: String,
    next_role: String,
) -> IpcResult<ProjectFileBundleV2Dto> {
    let project_uuid = parse_uuid(&project_uuid, "projectUuid")?;
    let file_uuid = parse_uuid(&file_uuid, "fileUuid")?;
    let normalized_role = normalize_project_file_role(&next_role)?;

    let bundle = db
        .update_project_file_role(project_uuid, file_uuid, &normalized_role)
        .await
        .map_err(IpcError::from)?;

    Ok(map_project_file_bundle(bundle))
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

fn map_new_project_args_from_assets_payload(
    payload: &CreateProjectWithAssetsPayload,
) -> Result<NewProjectArgs, InvokeError> {
    if payload.language_pairs.is_empty() {
        return Err(
            IpcError::Validation("project must include at least one language pair".into()).into(),
        );
    }

    let user_uuid = parse_uuid(&payload.user_uuid, "userUuid")?;
    let client_uuid = match payload.client_uuid.as_ref() {
        Some(value) => Some(parse_uuid(value, "clientUuid")?),
        None => None,
    };

    let subjects = payload
        .subjects
        .iter()
        .cloned()
        .map(|subject| ProjectSubjectInput { subject })
        .collect();

    let language_pairs = payload
        .language_pairs
        .clone()
        .into_iter()
        .map(map_project_language_pair_input)
        .collect();

    Ok(NewProjectArgs {
        project_uuid: Uuid::new_v4(),
        project_name: payload.project_name.clone(),
        project_status: payload.project_status.clone(),
        user_uuid,
        client_uuid,
        r#type: payload.r#type.clone(),
        notes: payload.notes.clone(),
        subjects,
        language_pairs,
    })
}

#[allow(dead_code)]
#[derive(Debug)]
struct CopiedAssetInfo {
    draft_id: String,
    file_uuid: Uuid,
    stored_rel_path: String,
    absolute_path: PathBuf,
    role: ProjectAssetRoleDto,
    size_bytes: Option<i64>,
    original_extension: String,
}

async fn copy_project_assets(
    project_root: &Path,
    assets: &[ProjectAssetDescriptorDto],
) -> Result<Vec<CopiedAssetInfo>, InvokeError> {
    if assets.is_empty() {
        return Ok(Vec::new());
    }

    let root = project_root.to_path_buf();
    let payload = assets.to_owned();

    let copied: Result<Vec<CopiedAssetInfo>, IpcError> = task::spawn_blocking(move || {
        let mut copied = Vec::with_capacity(payload.len());
        let mut created_paths = Vec::new();

        for descriptor in payload {
            let source_path = PathBuf::from(&descriptor.path);
            if !source_path.is_file() {
                cleanup_files(&created_paths);
                return Err(IpcError::Validation(format!(
                    "Source file '{}' does not exist or is not a file.",
                    descriptor.path
                )));
            }

            let destination_dir = resolve_asset_directory(&root, descriptor.role);
            let filename = build_destination_filename(&descriptor);
            let destination_path = destination_dir.join(&filename);

            if destination_path.exists() {
                cleanup_files(&created_paths);
                return Err(IpcError::Validation(format!(
                    "A file named '{}' already exists in the project.",
                    filename
                )));
            }

            fs::copy(&source_path, &destination_path).map_err(|error| {
                cleanup_files(&created_paths);
                IpcError::Internal(format!(
                    "Failed to copy '{}' to '{}': {}",
                    source_path.display(),
                    destination_path.display(),
                    error
                ))
            })?;

            let metadata = fs::metadata(&destination_path).map_err(|error| {
                cleanup_files(&created_paths);
                IpcError::Internal(format!(
                    "Unable to read metadata for '{}': {}",
                    destination_path.display(),
                    error
                ))
            })?;

            let relative_path = destination_path
                .strip_prefix(&root)
                .map(|path| path.to_string_lossy().to_string())
                .map_err(|error| {
                    cleanup_files(&created_paths);
                    IpcError::Internal(format!(
                        "Failed to compute relative path for '{}': {}",
                        destination_path.display(),
                        error
                    ))
                })?;

            created_paths.push(destination_path.clone());

            copied.push(CopiedAssetInfo {
                draft_id: descriptor.draft_id,
                file_uuid: Uuid::new_v4(),
                stored_rel_path: relative_path,
                absolute_path: destination_path,
                role: descriptor.role,
                size_bytes: metadata.len().try_into().ok(),
                original_extension: descriptor.extension,
            });
        }

        Ok(copied)
    })
    .await
    .map_err(|join_err| {
        InvokeError::from(IpcError::Internal(format!(
            "Failed to copy project assets: {join_err}"
        )))
    })?;

    copied.map_err(InvokeError::from)
}

fn resolve_asset_directory(root: &Path, role: ProjectAssetRoleDto) -> PathBuf {
    match role {
        ProjectAssetRoleDto::Processable => root.join("Translations"),
        ProjectAssetRoleDto::Reference | ProjectAssetRoleDto::Image => root.join("References"),
        ProjectAssetRoleDto::Instructions => root.join("Instructions"),
    }
}

fn build_destination_filename(descriptor: &ProjectAssetDescriptorDto) -> String {
    let mut name = descriptor.name.clone();
    if name.contains('/') || name.contains('\\') {
        name = name.replace(['/', '\\'], "_");
    }

    let ext = descriptor.extension.trim();
    if ext.is_empty() {
        return name;
    }

    let sanitized_ext = ext.trim_start_matches('.');
    if name
        .rsplit_once('.')
        .map(|(_, existing)| existing.eq_ignore_ascii_case(sanitized_ext))
        .unwrap_or(false)
    {
        name
    } else {
        format!("{name}.{}", sanitized_ext)
    }
}

fn cleanup_files(paths: &[PathBuf]) {
    for path in paths.iter().rev() {
        if let Err(error) = fs::remove_file(path) {
            log::warn!(
                target: "ipc::projects_v2",
                "Failed to remove copied file '{}': {}",
                path.display(),
                error
            );
        }
    }
}

fn emit_progress_event<R: Runtime>(
    app: &AppHandle<R>,
    folder_name: &str,
    project_uuid: Option<Uuid>,
    phase: &str,
    description: Option<&str>,
) {
    let payload = json!({
        "phase": phase,
        "projectFolderName": folder_name,
        "projectUuid": project_uuid.map(|value| value.to_string()),
        "description": description,
    });

    if let Err(error) = app.emit(PROJECT_CREATE_PROGRESS, payload) {
        log::warn!(
            target: "ipc::projects_v2",
            "failed to emit project creation progress event: {error}"
        );
    }
}

fn emit_completion_event<R: Runtime>(
    app: &AppHandle<R>,
    folder_name: &str,
    project_uuid: Uuid,
    task_count: usize,
) {
    let payload = json!({
        "projectFolderName": folder_name,
        "projectUuid": project_uuid.to_string(),
        "conversionTaskCount": task_count,
    });

    if let Err(error) = app.emit(PROJECT_CREATE_COMPLETE, payload) {
        log::warn!(
            target: "ipc::projects_v2",
            "failed to emit project creation completion event: {error}"
        );
    }
}

fn sanitize_locale_segment(input: &str) -> String {
    let trimmed = input.trim();
    let mut sanitized = String::with_capacity(trimmed.len());

    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' {
            sanitized.push(ch);
        } else if ch == '_' {
            sanitized.push('_');
        } else {
            sanitized.push('_');
        }
    }

    let collapsed = sanitized.trim_matches('_');
    if collapsed.is_empty() {
        "und".into()
    } else {
        collapsed.to_string()
    }
}

fn language_pair_directory_name(pair: &ProjectLanguagePairDto) -> String {
    let source = sanitize_locale_segment(&pair.source_lang);
    let target = sanitize_locale_segment(&pair.target_lang);
    format!("{source}_{target}")
}

async fn create_language_pair_directories(
    translations_root: &Path,
    language_pairs: &[ProjectLanguagePairDto],
) -> Result<(), InvokeError> {
    if language_pairs.is_empty() {
        return Ok(());
    }

    let root = translations_root.to_path_buf();
    let directories: Vec<String> = language_pairs
        .iter()
        .map(language_pair_directory_name)
        .collect();

    let creation_result = task::spawn_blocking(move || -> Result<(), IpcError> {
        let mut seen = HashSet::new();
        for dir_name in directories {
            if !seen.insert(dir_name.clone()) {
                continue;
            }

            let dir_path = root.join(&dir_name);
            if let Err(error) = fs::create_dir_all(&dir_path) {
                return Err(IpcError::Internal(format!(
                    "Failed to create translation directory '{}': {}",
                    dir_path.display(),
                    error
                )));
            }
        }

        Ok(())
    })
    .await
    .map_err(|join_err| {
        InvokeError::from(IpcError::Internal(format!(
            "Failed to create translation directories: {join_err}"
        )))
    })?;

    creation_result.map_err(InvokeError::from)
}

async fn cleanup_seeded_artifacts_and_jobs(
    db: &DbManager,
    jobs: &[(Uuid, String)],
    artifacts: &[Uuid],
) {
    for (artifact_uuid, job_type) in jobs.iter().rev() {
        if let Err(error) = db.delete_job_record(*artifact_uuid, job_type).await {
            log::warn!(
                target: "ipc::projects_v2",
                "failed to rollback job '{}': {}",
                artifact_uuid,
                error
            );
        }
    }

    for artifact_uuid in artifacts.iter().rev() {
        if let Err(error) = db.delete_artifact_record(*artifact_uuid).await {
            log::warn!(
                target: "ipc::projects_v2",
                "failed to rollback artifact '{}': {}",
                artifact_uuid,
                error
            );
        }
    }
}

async fn rollback_project_creation(db: &DbManager, project_uuid: Uuid) {
    if let Err(error) = db.delete_project_bundle(project_uuid).await {
        log::warn!(
            target: "ipc::projects_v2",
            "Failed to rollback project '{}' after finalize error: {}",
            project_uuid,
            error
        );
    }
}

async fn prepare_conversion_plan(
    db: &DbManager,
    project_uuid: Uuid,
    project_dir: &Path,
    copied_assets: &[CopiedAssetInfo],
    language_pairs: &[ProjectLanguagePairDto],
) -> Result<Option<ConversionPlanDto>, InvokeError> {
    if language_pairs.is_empty() {
        return Ok(None);
    }

    let translations_root = project_dir.join("Translations");
    create_language_pair_directories(&translations_root, language_pairs).await?;

    let processable_assets: Vec<&CopiedAssetInfo> = copied_assets
        .iter()
        .filter(|asset| matches!(asset.role, ProjectAssetRoleDto::Processable))
        .collect();

    if processable_assets.is_empty() {
        return Ok(Some(ConversionPlanDto {
            project_uuid: project_uuid.to_string(),
            tasks: Vec::new(),
            integrity_alerts: Vec::new(),
        }));
    }

    let mut tasks = Vec::new();
    let mut created_artifacts = Vec::new();
    let mut created_jobs = Vec::new();

    for asset in processable_assets {
        let source_path = asset.absolute_path.to_string_lossy().into_owned();
        let stored_rel_path = Path::new(&asset.stored_rel_path);
        let file_stem = stored_rel_path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(str::to_owned)
            .unwrap_or_else(|| "artifact".to_string());

        for pair in language_pairs {
            let language_dir = language_pair_directory_name(pair);
            let output_rel_path = Path::new("Translations")
                .join(&language_dir)
                .join(format!("{file_stem}.xlf"));
            let output_rel_path_str = output_rel_path.to_string_lossy().into_owned();
            let output_abs_path = project_dir.join(&output_rel_path);
            let output_abs_path_str = output_abs_path.to_string_lossy().into_owned();
            let artifact_uuid = Uuid::new_v4();
            let job_type = "xliff_conversion".to_string();

            let artifact_args = NewArtifactArgs {
                artifact_uuid,
                project_uuid,
                file_uuid: asset.file_uuid,
                artifact_type: "xliff".into(),
                size_bytes: None,
                segment_count: None,
                token_count: None,
                status: "PENDING".into(),
            };

            if let Err(error) = db.upsert_artifact_record(artifact_args).await {
                cleanup_seeded_artifacts_and_jobs(db, &created_jobs, &created_artifacts).await;
                return Err(IpcError::from(error).into());
            }
            created_artifacts.push(artifact_uuid);

            let job_args = NewJobArgs {
                artifact_uuid,
                job_type: job_type.clone(),
                project_uuid,
                job_status: "pending".into(),
                error_log: None,
            };

            if let Err(error) = db.upsert_job_record(job_args).await {
                cleanup_seeded_artifacts_and_jobs(db, &created_jobs, &created_artifacts).await;
                return Err(IpcError::from(error).into());
            }
            created_jobs.push((artifact_uuid, job_type.clone()));

            tasks.push(ConversionTaskDto {
                draft_id: asset.draft_id.clone(),
                file_uuid: Some(asset.file_uuid.to_string()),
                artifact_uuid: Some(artifact_uuid.to_string()),
                job_type: Some(job_type.clone()),
                source_lang: pair.source_lang.clone(),
                target_lang: pair.target_lang.clone(),
                source_path: source_path.clone(),
                xliff_rel_path: output_rel_path_str.clone(),
                xliff_abs_path: Some(output_abs_path_str.clone()),
                version: None,
                paragraph: Some(true),
                embed: Some(true),
            });
        }
    }

    log::debug!(
        target: "ipc::projects_v2",
        "Prepared {} conversion tasks for project {}",
        tasks.len(),
        project_uuid
    );

    Ok(Some(ConversionPlanDto {
        project_uuid: project_uuid.to_string(),
        tasks,
        integrity_alerts: Vec::new(),
    }))
}

async fn locate_project_root(
    projects_root: &Path,
    project_uuid: Uuid,
    bundle: &ProjectBundle,
) -> Result<PathBuf, IpcError> {
    let candidate = projects_root.join(project_uuid.to_string());
    if tokio::fs::metadata(&candidate).await.is_ok() {
        return Ok(candidate);
    }

    let stored_paths: Vec<PathBuf> = bundle
        .files
        .iter()
        .map(|file| PathBuf::from(&file.link.stored_at))
        .collect();

    if stored_paths.is_empty() {
        return Err(IpcError::Internal(format!(
            "Unable to resolve project directory for {} (no file records)",
            project_uuid
        )));
    }

    let root = projects_root.to_path_buf();
    let located = task::spawn_blocking(move || -> Result<Option<PathBuf>, io::Error> {
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            for rel in &stored_paths {
                if path.join(rel).exists() {
                    return Ok(Some(path));
                }
            }
        }
        Ok(None)
    })
    .await
    .map_err(|err| {
        IpcError::Internal(format!(
            "Failed to scan projects directory '{}': {}",
            projects_root.display(),
            err
        ))
    })?
    .map_err(|err| {
        IpcError::Internal(format!(
            "Unable to enumerate projects directory '{}': {}",
            projects_root.display(),
            err
        ))
    })?;

    located.ok_or_else(|| {
        IpcError::Internal(format!(
            "Unable to resolve filesystem root for project {} under {}",
            project_uuid,
            projects_root.display()
        ))
    })
}

async fn ensure_conversion_artifact(
    db: &DbManager,
    project_uuid: Uuid,
    file_uuid: Uuid,
) -> Result<Uuid, IpcError> {
    let artifacts = db
        .list_artifacts_for_file(project_uuid, file_uuid)
        .await
        .map_err(IpcError::from)?;

    if let Some(existing) = artifacts
        .into_iter()
        .find(|artifact| artifact.artifact_type.eq_ignore_ascii_case("xliff"))
    {
        return Ok(existing.artifact_uuid);
    }

    let artifact_uuid = Uuid::new_v4();
    db.upsert_artifact_record(NewArtifactArgs {
        artifact_uuid,
        project_uuid,
        file_uuid,
        artifact_type: "xliff".into(),
        size_bytes: None,
        segment_count: None,
        token_count: None,
        status: "PENDING".into(),
    })
    .await
    .map_err(IpcError::from)?;

    Ok(artifact_uuid)
}

async fn ensure_conversion_job(
    db: &DbManager,
    project_uuid: Uuid,
    artifact_uuid: Uuid,
    job_status: &str,
    error_log: Option<String>,
) -> Result<(), IpcError> {
    db.upsert_job_record(NewJobArgs {
        artifact_uuid,
        job_type: "xliff_conversion".into(),
        project_uuid,
        job_status: job_status.to_string(),
        error_log,
    })
    .await
    .map_err(IpcError::from)?;
    Ok(())
}

fn relative_to_project(path: &Path, project_root: &Path) -> Result<String, IpcError> {
    let relative = path.strip_prefix(project_root).map_err(|_| {
        IpcError::Internal(format!(
            "Failed to compute relative path for '{}' against '{}'",
            path.display(),
            project_root.display()
        ))
    })?;
    Ok(relative.to_string_lossy().into_owned())
}

fn map_asset_role_to_file_info_type(role: ProjectAssetRoleDto) -> String {
    match role {
        ProjectAssetRoleDto::Processable => "processable".to_string(),
        ProjectAssetRoleDto::Reference => "reference".to_string(),
        ProjectAssetRoleDto::Instructions => "instructions".to_string(),
        ProjectAssetRoleDto::Image => "image".to_string(),
    }
}

fn map_asset_role_to_project_file_type(role: ProjectAssetRoleDto) -> String {
    match role {
        ProjectAssetRoleDto::Processable => "processable".to_string(),
        ProjectAssetRoleDto::Reference => "reference".to_string(),
        ProjectAssetRoleDto::Instructions => "instructions".to_string(),
        ProjectAssetRoleDto::Image => "image".to_string(),
    }
}

fn file_language_pairs_for_role(
    role: ProjectAssetRoleDto,
    pairs: &[ProjectLanguagePairDto],
) -> Vec<FileLanguagePairInput> {
    if !matches!(role, ProjectAssetRoleDto::Processable) {
        return Vec::new();
    }

    pairs
        .iter()
        .map(|pair| FileLanguagePairInput {
            source_lang: pair.source_lang.clone(),
            target_lang: pair.target_lang.clone(),
        })
        .collect()
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

fn map_project_statistics(stats: ProjectStatistics) -> ProjectStatisticsDto {
    ProjectStatisticsDto {
        totals: ProjectFileTotalsDto {
            total: stats.totals.total,
            processable: stats.totals.processable,
            reference: stats.totals.reference,
            instructions: stats.totals.instructions,
            image: stats.totals.image,
            other: stats.totals.other,
        },
        conversions: ProjectConversionStatsDto {
            total: stats.conversions.total,
            completed: stats.conversions.completed,
            failed: stats.conversions.failed,
            pending: stats.conversions.pending,
            running: stats.conversions.running,
            other: stats.conversions.other,
            segments: stats.conversions.segments,
            tokens: stats.conversions.tokens,
        },
        jobs: ProjectJobStatsDto {
            total: stats.jobs.total,
            completed: stats.jobs.completed,
            failed: stats.jobs.failed,
            pending: stats.jobs.pending,
            running: stats.jobs.running,
            other: stats.jobs.other,
        },
        progress: ProjectProgressStatsDto {
            processable_files: stats.progress.processable_files,
            files_ready: stats.progress.files_ready,
            files_with_errors: stats.progress.files_with_errors,
            percent_complete: stats.progress.percent_complete,
        },
        warnings: ProjectWarningStatsDto {
            total: stats.warnings.total,
            failed_artifacts: stats.warnings.failed_artifacts,
            failed_jobs: stats.warnings.failed_jobs,
        },
        last_activity: stats.last_activity,
    }
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
        client_name: None,
        r#type: record.r#type,
        notes: record.notes,
        subjects: None,
        file_count: None,
    }
}

fn map_project_list_record(record: ProjectListRecord) -> ProjectRecordV2Dto {
    ProjectRecordV2Dto {
        project_uuid: record.project_uuid.to_string(),
        project_name: record.project_name,
        creation_date: record.creation_date,
        update_date: record.update_date,
        project_status: record.project_status,
        user_uuid: record.user_uuid.to_string(),
        client_uuid: record.client_uuid.map(|id| id.to_string()),
        client_name: record.client_name,
        r#type: record.r#type,
        notes: record.notes,
        subjects: Some(record.subjects.0),
        file_count: Some(record.file_count),
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

fn normalize_project_file_role(value: &str) -> Result<String, IpcError> {
    let normalized = value.trim().to_lowercase();
    match normalized.as_str() {
        "processable" | "reference" | "instructions" | "image" => Ok(normalized),
        _ => Err(IpcError::Validation(format!(
            "Unsupported project file role '{value}'"
        ))),
    }
}

fn validate_project_folder_name(name: &str) -> Result<&str, InvokeError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(IpcError::Validation("projectFolderName cannot be empty.".into()).into());
    }

    const MAX_LEN: usize = 120;
    if trimmed.len() > MAX_LEN {
        return Err(IpcError::Validation(format!(
            "projectFolderName must be at most {MAX_LEN} characters."
        ))
        .into());
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(IpcError::Validation(
            "projectFolderName must not contain path separators.".into(),
        )
        .into());
    }

    const INVALID_CHARS: [char; 8] = ['<', '>', ':', '"', '|', '?', '*', '\''];
    if trimmed
        .chars()
        .any(|ch| ch.is_control() || INVALID_CHARS.contains(&ch) || ch.is_whitespace())
    {
        return Err(IpcError::Validation(
            "projectFolderName contains unsupported characters.".into(),
        )
        .into());
    }

    Ok(trimmed)
}

async fn ensure_destination_available(path: PathBuf, folder_name: &str) -> Result<(), InvokeError> {
    let display = path.display().to_string();
    let slug = folder_name.to_string();
    let exists = task::spawn_blocking(move || match std::fs::metadata(&path) {
        Ok(_) => Ok(true),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(err) => Err(err),
    })
    .await
    .map_err(|join_err| {
        IpcError::Internal(format!(
            "failed to inspect project destination '{display}': {join_err}"
        ))
    })?
    .map_err(|error| {
        IpcError::Internal(format!(
            "unable to inspect project destination '{display}': {error}"
        ))
    })?;

    if exists {
        return Err(IpcError::Validation(format!(
            "A project folder named '{slug}' already exists. Choose a different name."
        ))
        .into());
    }

    Ok(())
}

async fn create_project_scaffold(root: PathBuf) -> Result<DirectoryCreationGuard, InvokeError> {
    let root_clone = root.clone();
    let created = task::spawn_blocking(move || -> Result<Vec<PathBuf>, io::Error> {
        let mut created_paths = Vec::new();

        let mut create_dir = |path: &PathBuf| -> Result<(), io::Error> {
            if let Err(error) = fs::create_dir_all(path) {
                cleanup_created(&created_paths);
                return Err(error);
            }
            created_paths.push(path.clone());
            Ok(())
        };

        create_dir(&root_clone)?;

        let translations = root_clone.join("Translations");
        create_dir(&translations)?;

        let references = root_clone.join("References");
        create_dir(&references)?;

        let instructions = root_clone.join("Instructions");
        create_dir(&instructions)?;

        Ok(created_paths)
    })
    .await
    .map_err(|join_err| {
        IpcError::Internal(format!(
            "failed to create project directories '{}': {join_err}",
            root.display()
        ))
    })?
    .map_err(|error| {
        IpcError::Internal(format!(
            "unable to create project directories '{}': {error}",
            root.display()
        ))
    })?;

    Ok(DirectoryCreationGuard::new(root, created))
}

fn cleanup_created(created: &[PathBuf]) {
    for path in created.iter().rev() {
        if let Err(error) = fs::remove_dir_all(path) {
            log::warn!(
                target: "ipc::projects_v2",
                "failed to remove partially created directory '{}': {error}",
                path.display()
            );
        }
    }
}

struct DirectoryCreationGuard {
    root: PathBuf,
    created: Vec<PathBuf>,
    committed: bool,
}

impl DirectoryCreationGuard {
    fn new(root: PathBuf, created: Vec<PathBuf>) -> Self {
        Self {
            root,
            created,
            committed: false,
        }
    }

    #[allow(dead_code)]
    fn root(&self) -> &PathBuf {
        &self.root
    }

    #[allow(dead_code)]
    fn commit(mut self) {
        self.committed = true;
    }
}

impl Drop for DirectoryCreationGuard {
    fn drop(&mut self) {
        if self.committed {
            return;
        }

        cleanup_created(&self.created);
    }
}

#[allow(dead_code)]
pub mod test_support {
    use super::*;
    use crate::settings::{AppSettings, SettingsManager};

    #[allow(dead_code)]
    pub struct TestDirectoryGuard(DirectoryCreationGuard);

    impl TestDirectoryGuard {
        #[allow(dead_code)]
        pub fn project_root(&self) -> &Path {
            self.0.root()
        }

        #[allow(dead_code)]
        pub fn commit(self) {
            self.0.commit();
        }
    }

    #[allow(dead_code)]
    pub async fn create_scaffold(root: PathBuf) -> Result<TestDirectoryGuard, InvokeError> {
        create_project_scaffold(root).await.map(TestDirectoryGuard)
    }

    #[allow(dead_code)]
    pub async fn copy_assets(
        project_root: &Path,
        assets: &[ProjectAssetDescriptorDto],
    ) -> Result<Vec<String>, InvokeError> {
        copy_project_assets(project_root, assets)
            .await
            .map(|copied| {
                copied
                    .into_iter()
                    .map(|info| info.stored_rel_path.clone())
                    .collect()
            })
    }

    #[allow(dead_code)]
    pub fn build_settings_manager(app_folder: PathBuf) -> SettingsManager {
        let settings_path = app_folder.join("settings.yaml");

        let settings = AppSettings {
            app_folder: app_folder.clone(),
            auto_convert_on_open: true,
            theme: "auto".into(),
            ui_language: "en".into(),
            default_source_language: "en-US".into(),
            default_target_language: "es-ES".into(),
            default_xliff_version: "2.1".into(),
            show_notifications: true,
            enable_sound_notifications: false,
            max_parallel_conversions: 4,
            database_journal_mode: "WAL".into(),
            database_synchronous: "NORMAL".into(),
        };

        SettingsManager::new(settings_path, settings)
    }
}

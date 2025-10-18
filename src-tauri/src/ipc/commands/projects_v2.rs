use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::ipc::InvokeError;
use tauri::State;
use tokio::task;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{
    FileInfoRecord, FileLanguagePairInput, NewFileInfoArgs, NewProjectArgs, NewProjectFileArgs,
    ProjectBundle, ProjectFileBundle, ProjectLanguagePairInput, ProjectRecord, ProjectSubjectInput,
    UpdateProjectArgs,
};
use crate::ipc::dto::{
    ArtifactV2Dto, AttachProjectFilePayload, CreateProjectPayload,
    CreateProjectWithAssetsPayload, CreateProjectWithAssetsResponseDto, FileInfoV2Dto,
    FileLanguagePairDto, JobV2Dto, ProjectAssetDescriptorDto, ProjectAssetResultDto,
    ProjectAssetRoleDto, ProjectBundleV2Dto, ProjectFileBundleV2Dto, ProjectFileLinkDto,
    ProjectLanguagePairDto, ProjectRecordV2Dto, UpdateProjectPayload,
};
use crate::settings::SettingsManager;
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn create_project_with_assets_v2(
    db: State<'_, DbManager>,
    settings: State<'_, SettingsManager>,
    payload: CreateProjectWithAssetsPayload,
) -> IpcResult<CreateProjectWithAssetsResponseDto> {
    log::info!(
        target: "ipc::projects_v2",
        "create_project_with_assets_v2 invoked for project '{}'",
        payload.project_name
    );

    let folder_name = validate_project_folder_name(&payload.project_folder_name)?;
    let settings_snapshot = settings.current().await;
    let projects_root = settings_snapshot.projects_dir();
    let destination = projects_root.join(folder_name);

    ensure_destination_available(destination.clone(), folder_name).await?;
    let scaffold_guard = create_project_scaffold(destination.clone()).await?;

    let project_args = map_new_project_args_from_assets_payload(&payload)?;
    let project_bundle = db
        .create_project_bundle(project_args)
        .await
        .map_err(IpcError::from)?;

    let project_uuid = project_bundle.project.project_uuid;

    let copied_assets = copy_project_assets(&destination, &payload.assets).await?;

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
        return Err(error.into());
    }

    let refreshed_bundle = db
        .get_project_bundle(project_uuid)
        .await
        .map_err(IpcError::from)?
        .ok_or_else(|| {
            IpcError::Internal("Project bundle not found after attachments.".into())
        })?;

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
        conversion_plan: None,
    };

    scaffold_guard.commit();

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

fn map_new_project_args_from_assets_payload(
    payload: &CreateProjectWithAssetsPayload,
) -> Result<NewProjectArgs, InvokeError> {
    if payload.language_pairs.is_empty() {
        return Err(IpcError::Validation(
            "project must include at least one language pair".into(),
        )
        .into());
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
        return Err(
            IpcError::Validation("projectFolderName must not contain path separators.".into()).into(),
        );
    }

    const INVALID_CHARS: [char; 8] = ['<', '>', ':', '"', '|', '?', '*', '\''];
    if trimmed
        .chars()
        .any(|ch| ch.is_control() || INVALID_CHARS.contains(&ch) || ch.is_whitespace())
    {
        return Err(
            IpcError::Validation("projectFolderName contains unsupported characters.".into()).into(),
        );
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
        return Err(
            IpcError::Validation(format!(
                "A project folder named '{slug}' already exists. Choose a different name."
            ))
            .into(),
        );
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

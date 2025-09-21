use std::collections::HashSet;
use std::ffi::OsStr;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{fs, time::sleep};
use uuid::Uuid;

use super::dto::{
    AppHealthReport, AppSettingsDto, CreateProjectRequest, CreateProjectResponse, JobAccepted,
    ProjectListItemDto, TranslationCompletedPayload, TranslationFailedPayload,
    TranslationHistoryRecord, TranslationProgressPayload, TranslationRequest, TranslationStage,
};
use super::error::{IpcError, IpcResult};
use super::events::{TRANSLATION_COMPLETED, TRANSLATION_FAILED, TRANSLATION_PROGRESS};
use super::state::{JobRecord, TranslationState};

use crate::db::{
    DbManager, NewProject, NewProjectFile, NewTranslationRecord, PersistedTranslationOutput,
    ProjectFileImportStatus, ProjectListItem, ProjectStatus, ProjectType, SQLITE_DB_FILE,
};
use crate::settings::{SettingsManager, move_directory};

const MAX_LANGUAGE_LENGTH: usize = 64;
const MAX_TEXT_LENGTH: usize = 20_000;
const PROJECT_NAME_MIN_LEN: usize = 2;
const PROJECT_NAME_MAX_LEN: usize = 120;
const PROJECTS_DIR_NAME: &str = "projects";
const ALLOWED_PROJECT_EXTENSIONS: &[&str] = &["docx", "doc", "xliff", "mqxliff", "sdlxliff"];

async fn build_app_settings_dto(
    app: &AppHandle,
    settings: &SettingsManager,
) -> Result<AppSettingsDto, IpcError> {
    let current = settings.current().await;
    let app_folder = current.app_folder.clone();
    let database_path = current.database_path(SQLITE_DB_FILE);
    let projects_path = current.projects_dir();
    let settings_file = settings.file_path().to_path_buf();

    let default_app_folder = app.path().app_data_dir().map_err(|error| {
        error!(
            target: "ipc::settings",
            "failed to resolve default app data directory: {error}"
        );
        IpcError::Internal("Unable to resolve application data directory.".into())
    })?;

    let app_folder_exists = path_exists_bool(&app_folder).await;
    let database_exists = path_exists_bool(&database_path).await;
    let projects_path_exists = path_exists_bool(&projects_path).await;
    let settings_file_exists = settings_file.exists();

    Ok(AppSettingsDto {
        app_folder: app_folder.to_string_lossy().into_owned(),
        app_folder_exists,
        database_path: database_path.to_string_lossy().into_owned(),
        database_exists,
        projects_path: projects_path.to_string_lossy().into_owned(),
        projects_path_exists,
        settings_file: settings_file.to_string_lossy().into_owned(),
        settings_file_exists,
        default_app_folder: default_app_folder.to_string_lossy().into_owned(),
        is_using_default_location: app_folder == default_app_folder,
    })
}

async fn path_exists_bool(path: &Path) -> bool {
    match fs::try_exists(path).await {
        Ok(result) => result,
        Err(error) => {
            warn!(
                target: "ipc::settings",
                "failed to probe path existence for {:?}: {error}",
                path
            );
            false
        }
    }
}

async fn directory_is_empty(path: &Path) -> Result<bool, std::io::Error> {
    let mut entries = fs::read_dir(path).await?;
    Ok(entries.next_entry().await?.is_none())
}

fn fs_error(action: &str, error: std::io::Error) -> IpcError {
    error!(
        target: "ipc::settings",
        "filesystem error while attempting to {action}: {error}"
    );
    IpcError::Internal("File system operation failed. Check folder permissions and retry.".into())
}

#[tauri::command]
pub async fn create_project_with_files(
    _app: AppHandle,
    settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    req: CreateProjectRequest,
) -> IpcResult<CreateProjectResponse> {
    let name = req.name.trim();
    if name.len() < PROJECT_NAME_MIN_LEN || name.len() > PROJECT_NAME_MAX_LEN {
        return Err(IpcError::Validation(format!(
            "Project name must be between {PROJECT_NAME_MIN_LEN} and {PROJECT_NAME_MAX_LEN} characters.",
        ))
        .into());
    }

    if !name.chars().any(|ch| ch.is_alphanumeric()) {
        return Err(IpcError::Validation(
            "Project name must include at least one alphanumeric character.".into(),
        )
        .into());
    }

    let project_type_value = req.project_type.trim().to_lowercase();
    let project_type = ProjectType::from_str(&project_type_value).ok_or_else(|| {
        IpcError::Validation("Project type must be either 'translation' or 'rag'.".into())
    })?;

    if req.files.is_empty() {
        return Err(
            IpcError::Validation("Select at least one file to create a project.".into()).into(),
        );
    }

    let mut unique_paths = HashSet::new();
    let mut pending_files = Vec::new();

    for raw in &req.files {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(IpcError::Validation("File paths cannot be empty.".into()).into());
        }

        let candidate_path = PathBuf::from(trimmed);
        let canonical_path = match fs::canonicalize(&candidate_path).await {
            Ok(path) => path,
            Err(error) => {
                warn!(
                    target: "ipc::projects",
                    "failed to canonicalize file '{trimmed}': {error}"
                );
                return Err(
                    IpcError::Validation(format!("File '{trimmed}' is not accessible.")).into(),
                );
            }
        };

        if !unique_paths.insert(canonical_path.clone()) {
            continue;
        }

        let metadata = match fs::metadata(&canonical_path).await {
            Ok(meta) => meta,
            Err(error) => {
                warn!(
                    target: "ipc::projects",
                    "failed to read metadata for '{:?}': {error}",
                    canonical_path
                );
                return Err(
                    IpcError::Validation(format!("File '{trimmed}' is not accessible.")).into(),
                );
            }
        };

        if !metadata.is_file() {
            return Err(IpcError::Validation(format!("'{trimmed}' is not a regular file.")).into());
        }

        let extension = canonical_path
            .extension()
            .and_then(OsStr::to_str)
            .map(|ext| ext.to_lowercase())
            .ok_or_else(|| {
                IpcError::Validation(format!(
                    "File '{}' is missing an extension.",
                    canonical_path.display()
                ))
            })?;

        if !ALLOWED_PROJECT_EXTENSIONS.contains(&extension.as_str()) {
            return Err(IpcError::Validation(format!(
                "File '{}' has an unsupported extension (allowed: {}).",
                canonical_path.display(),
                ALLOWED_PROJECT_EXTENSIONS.join(", ")
            ))
            .into());
        }

        let original_name = canonical_path
            .file_name()
            .and_then(OsStr::to_str)
            .map(str::to_string)
            .ok_or_else(|| {
                IpcError::Validation(format!(
                    "Unable to determine file name for '{}'.",
                    canonical_path.display()
                ))
            })?;

        pending_files.push((canonical_path, original_name, extension));
    }

    if pending_files.is_empty() {
        return Err(IpcError::Validation("No unique files were selected.".into()).into());
    }

    let project_id = Uuid::new_v4();
    let slug = build_project_slug(name, project_id);

    let app_folder = settings.app_folder().await;
    let projects_dir = app_folder.join(PROJECTS_DIR_NAME);
    if let Err(error) = fs::create_dir_all(&projects_dir).await {
        error!(
            target: "ipc::projects",
            "failed to prepare projects directory {:?}: {error}",
            projects_dir
        );
        return Err(
            IpcError::Internal("Unable to prepare projects storage directory.".into()).into(),
        );
    }

    let folder_name = format!("{}-{}", project_id, slug);
    let project_dir = projects_dir.join(folder_name);
    if let Err(error) = fs::create_dir_all(&project_dir).await {
        error!(
            target: "ipc::projects",
            "failed to create project directory {:?}: {error}",
            project_dir
        );
        return Err(IpcError::Internal("Unable to create project directory.".into()).into());
    }

    let mut imported_files = Vec::with_capacity(pending_files.len());

    for (source_path, original_name, extension) in &pending_files {
        let candidate_name = match next_available_file_name(&project_dir, original_name).await {
            Ok(name) => name,
            Err(error) => {
                error!(
                    target: "ipc::projects",
                    "failed to resolve unique filename for {:?}: {error}",
                    original_name
                );
                cleanup_project_dir(&project_dir).await;
                return Err(IpcError::Internal(
                    "Unable to stage imported files for the project.".into(),
                )
                .into());
            }
        };

        let destination_path = project_dir.join(&candidate_name);
        if let Err(error) = fs::copy(source_path, &destination_path).await {
            error!(
                target: "ipc::projects",
                "failed to copy file {:?} -> {:?}: {error}",
                source_path,
                destination_path
            );
            cleanup_project_dir(&project_dir).await;
            return Err(IpcError::Internal(
                "Unable to copy selected files into the project.".into(),
            )
            .into());
        }

        let stored_rel_path = candidate_name.clone();

        let size_bytes = match fs::metadata(&destination_path).await {
            Ok(meta) => i64::try_from(meta.len()).ok(),
            Err(error) => {
                warn!(
                    target: "ipc::projects",
                    "failed to inspect copied file {:?}: {error}",
                    destination_path
                );
                None
            }
        };

        imported_files.push(NewProjectFile {
            id: Uuid::new_v4(),
            project_id,
            original_name: original_name.clone(),
            original_path: source_path.display().to_string(),
            stored_rel_path,
            ext: extension.clone(),
            size_bytes,
            checksum_sha256: None,
            import_status: ProjectFileImportStatus::Imported,
        });
    }

    let project_record = NewProject {
        id: project_id,
        name: name.to_string(),
        slug: slug.clone(),
        project_type,
        root_path: project_dir.display().to_string(),
        status: ProjectStatus::Active,
        metadata: None,
    };

    if let Err(error) = db
        .insert_project_with_files(&project_record, &imported_files)
        .await
    {
        error!(
            target: "ipc::projects",
            "failed to persist project {:?}: {error}",
            project_id
        );
        cleanup_project_dir(&project_dir).await;
        return Err(IpcError::from(error).into());
    }

    info!(
        target: "ipc::projects",
        "created project {project_id} with {count} file(s)",
        count = imported_files.len()
    );

    Ok(CreateProjectResponse {
        project_id: project_id.to_string(),
        slug,
        folder: project_dir.display().to_string(),
        file_count: imported_files.len(),
    })
}

#[tauri::command]
pub async fn list_projects(
    db: State<'_, DbManager>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> IpcResult<Vec<ProjectListItemDto>> {
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let offset = offset.unwrap_or(0).max(0);

    let records = db.list_projects(limit, offset).await?;
    let items = records.into_iter().map(project_list_item_to_dto).collect();

    Ok(items)
}

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

#[tauri::command]
pub async fn get_app_settings(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
) -> IpcResult<AppSettingsDto> {
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_app_folder(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    translation_state: State<'_, TranslationState>,
    new_folder: String,
) -> IpcResult<AppSettingsDto> {
    let candidate_raw = new_folder.trim();
    if candidate_raw.is_empty() {
        return Err(IpcError::Validation("Select a destination folder.".into()).into());
    }

    let candidate_path = PathBuf::from(candidate_raw);
    if !candidate_path.is_absolute() {
        return Err(IpcError::Validation(
            "Select an absolute path for the application folder.".into(),
        )
        .into());
    }

    if !translation_state.snapshot().is_empty() {
        return Err(IpcError::Validation(
            "Finish or cancel active translation jobs before moving the application folder.".into(),
        )
        .into());
    }

    let current_settings = settings.current().await;
    if candidate_path == current_settings.app_folder {
        return build_app_settings_dto(&app, &settings)
            .await
            .map_err(Into::into);
    }

    if candidate_path.starts_with(&current_settings.app_folder)
        || current_settings.app_folder.starts_with(&candidate_path)
    {
        return Err(IpcError::Validation(
            "Select a folder that is not nested within the current application directory.".into(),
        )
        .into());
    }

    if let Some(parent) = candidate_path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| fs_error("prepare parent directories", error))?;
    }

    let destination_exists = path_exists_bool(&candidate_path).await;
    if destination_exists {
        let metadata = fs::metadata(&candidate_path)
            .await
            .map_err(|error| fs_error("inspect destination folder", error))?;
        if !metadata.is_dir() {
            return Err(IpcError::Validation(
                "The selected path points to a file. Choose a folder instead.".into(),
            )
            .into());
        }

        let is_empty = directory_is_empty(&candidate_path)
            .await
            .map_err(|error| fs_error("inspect destination folder contents", error))?;
        if !is_empty {
            return Err(IpcError::Validation(
                "Choose an empty folder or remove its contents before moving the data.".into(),
            )
            .into());
        }

        fs::remove_dir(&candidate_path)
            .await
            .map_err(|error| fs_error("prepare destination directory", error))?;
    }

    match move_directory(&current_settings.app_folder, &candidate_path).await {
        Ok(_) => {}
        Err(error) => {
            error!(
                target: "ipc::settings",
                "failed to move application data from {:?} to {:?}: {error}",
                current_settings.app_folder,
                candidate_path
            );
            return Err(IpcError::Internal(
                "Unable to move application data to the selected folder.".into(),
            )
            .into());
        }
    }

    if let Err(error) = db.reopen_with_base_dir(&candidate_path).await {
        error!(
            target: "ipc::settings",
            "failed to reopen database from new folder {:?}: {error}",
            candidate_path
        );

        if let Err(revert_error) =
            move_directory(&candidate_path, &current_settings.app_folder).await
        {
            error!(
                target: "ipc::settings",
                "failed to revert application data after reopening error: {revert_error}"
            );
        }

        return Err(IpcError::Internal(
            "Failed to reopen the database after moving files. Data was restored to the previous location.".into(),
        )
        .into());
    }

    if let Err(error) = settings
        .update_and_save_app_folder(candidate_path.clone())
        .await
    {
        error!(
            target: "ipc::settings",
            "failed to persist settings after folder move: {error}"
        );

        if let Err(reopen_error) = db.reopen_with_base_dir(&current_settings.app_folder).await {
            error!(
                target: "ipc::settings",
                "failed to reopen database at previous folder after persistence error: {reopen_error}"
            );
        }

        if let Err(revert_error) =
            move_directory(&candidate_path, &current_settings.app_folder).await
        {
            error!(
                target: "ipc::settings",
                "failed to revert application data after settings persistence error: {revert_error}"
            );
        }

        return Err(IpcError::Internal(
            "Unable to persist the updated settings. Application data was moved back to the previous folder.".into(),
        )
        .into());
    }

    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn path_exists(path: String) -> Result<(bool, bool, bool), ()> {
    // Returns (exists, is_file, is_dir)
    let p = Path::new(&path);
    let exists = p.exists();
    let is_file = exists && p.is_file();
    let is_dir = exists && p.is_dir();
    Ok((exists, is_file, is_dir))
}

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

#[tauri::command]
pub async fn clear_translation_history(db: State<'_, DbManager>) -> IpcResult<u64> {
    let deleted = db.clear_history().await?;
    Ok(deleted)
}

#[tauri::command]
pub async fn get_translation_job(
    db: State<'_, DbManager>,
    job_id: Uuid,
) -> IpcResult<Option<TranslationHistoryRecord>> {
    let record = db.get_job(job_id).await?;
    Ok(record)
}

fn project_list_item_to_dto(project: ProjectListItem) -> ProjectListItemDto {
    ProjectListItemDto {
        project_id: project.id.to_string(),
        name: project.name,
        slug: project.slug,
        project_type: project.project_type.as_str().to_string(),
        status: project.status.as_str().to_string(),
        file_count: project.file_count,
        created_at: project.created_at,
        updated_at: project.updated_at,
    }
}

async fn next_available_file_name(
    dir: &Path,
    original_name: &str,
) -> Result<String, std::io::Error> {
    let mut candidate = if original_name.is_empty() {
        "file".to_string()
    } else {
        original_name.to_string()
    };

    let mut counter = 1usize;
    loop {
        let path = dir.join(&candidate);
        match fs::metadata(&path).await {
            Ok(_) => {
                candidate = format_collision_name(original_name, counter);
                counter += 1;
            }
            Err(error) => {
                if error.kind() == ErrorKind::NotFound {
                    return Ok(candidate);
                }
                return Err(error);
            }
        }
    }
}

async fn cleanup_project_dir(path: &Path) {
    match fs::remove_dir_all(path).await {
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            warn!(
                target: "ipc::projects",
                "failed to cleanup project directory {:?}: {error}",
                path
            );
        }
    }
}

fn format_collision_name(original_name: &str, counter: usize) -> String {
    let path = Path::new(original_name);
    let stem = path
        .file_stem()
        .and_then(OsStr::to_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("file");
    let ext = path.extension().and_then(OsStr::to_str);
    match ext {
        Some(ext) if !ext.is_empty() => format!("{stem}-{counter}.{ext}"),
        _ => format!("{stem}-{counter}"),
    }
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;

    for ch in name.chars() {
        let lower = ch.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            slug.push(lower);
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }

    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "project".into()
    } else {
        trimmed
    }
}

fn build_project_slug(name: &str, project_id: Uuid) -> String {
    let base = slugify(name);
    let mut unique = project_id.simple().to_string();
    unique.truncate(8);
    format!("{base}-{unique}")
}

#[cfg(test)]
mod tests {
    use super::{build_project_slug, format_collision_name, slugify};
    use uuid::Uuid;

    #[test]
    fn slugify_normalizes_and_trims() {
        assert_eq!(slugify("  Marketing Launch  "), "marketing-launch");
    }

    #[test]
    fn slugify_falls_back_when_no_ascii_characters() {
        assert_eq!(slugify("项目"), "project");
    }

    #[test]
    fn format_collision_name_appends_suffix() {
        assert_eq!(format_collision_name("document.docx", 2), "document-2.docx");
        assert_eq!(format_collision_name("README", 3), "README-3");
    }

    #[test]
    fn build_project_slug_appends_unique_suffix() {
        let id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();
        assert_eq!(
            build_project_slug("Marketing Launch", id),
            "marketing-launch-12345678"
        );
    }
}

use std::collections::{HashMap, HashSet};
use std::ffi::OsStr;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use log::{error, info, warn};
use serde::Serialize;
use tauri::ipc::InvokeError;
use tauri::{AppHandle, State};
use tokio::fs;
use uuid::Uuid;

use super::shared::{fs_error, with_project_file_lock};
use crate::db::{
    DbManager, NewProject, NewProjectFile, ProjectDetails, ProjectFileConversionRow,
    ProjectFileDetails, ProjectFileImportStatus, ProjectListItem, ProjectStatus, ProjectType,
};
use crate::ipc::dto::{
    AddFilesResponseDto, CreateProjectRequest, CreateProjectResponse, EnsureConversionsPlanDto,
    EnsureConversionsTaskDto, ProjectDetailsDto, ProjectFileConversionDto, ProjectFileDto,
    ProjectFileWithConversionsDto, ProjectListItemDto,
};
use crate::ipc::error::{IpcError, IpcResult};
use crate::jliff::{ConversionOptions, JliffDocument, convert_xliff};
use crate::settings::SettingsManager;

const PROJECT_NAME_MIN_LEN: usize = 2;
const PROJECT_NAME_MAX_LEN: usize = 120;
const PROJECTS_DIR_NAME: &str = "projects";

// Accept all convertible inputs plus XLIFF variants (already-converted)
const ALLOWED_PROJECT_EXTENSIONS: &[&str] = &[
    // Convertible document formats
    "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "html", "xml", "dita", "md",
    // XLIFF-like formats (treated as already-converted)
    "xlf", "xliff", "mqxliff", "sdlxliff",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JliffConversionResultDto {
    pub file_id: String,
    pub jliff_abs_path: String,
    pub jliff_rel_path: String,
    pub tag_map_abs_path: String,
    pub tag_map_rel_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJliffSegmentResultDto {
    pub updated_count: usize,
    pub updated_at: String,
}

/// Creates a new project, copies the provided source files into the project
/// directory, and persists the metadata to the database.
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
            // silently skip duplicates so we can continue importing other files
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
            original_name: original_name.to_string(),
            original_path: source_path.display().to_string(),
            stored_rel_path,
            ext: extension.to_string(),
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
        default_src_lang: req
            .default_src_lang
            .clone()
            .filter(|s| !s.trim().is_empty())
            .or(Some("en-US".into())),
        default_tgt_lang: req
            .default_tgt_lang
            .clone()
            .filter(|s| !s.trim().is_empty())
            .or(Some("it-IT".into())),
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

/// Returns denormalised details for a single project, including file metadata
/// and previously generated conversion records.
#[tauri::command]
pub async fn get_project_details(
    db: State<'_, DbManager>,
    project_id: Uuid,
) -> IpcResult<ProjectDetailsDto> {
    let details = db.list_project_details(project_id).await?;
    Ok(project_details_to_dto(&details))
}

/// Imports additional files into an existing project directory and records them
/// in the database. The implementation mirrors project creation so we keep
/// validation and logging identical.
#[tauri::command]
pub async fn add_files_to_project(
    _app: AppHandle,
    _settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    project_id: Uuid,
    files: Vec<String>,
) -> IpcResult<AddFilesResponseDto> {
    if files.is_empty() {
        return Err(IpcError::Validation("Select at least one file to add.".into()).into());
    }

    // Resolve project root before we start copying files so we fail fast if the
    // project is missing.
    let project_root = db.project_root_path(project_id).await?;
    let mut unique_paths = HashSet::new();
    let mut pending_files = Vec::new();

    for raw in &files {
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

    // Copy files in and prepare DB rows
    let mut imported_files = Vec::with_capacity(pending_files.len());
    for (source_path, original_name, extension) in &pending_files {
        let candidate_name = match next_available_file_name(&project_root, original_name).await {
            Ok(name) => name,
            Err(error) => {
                error!(
                    target: "ipc::projects",
                    "failed to resolve unique filename for {:?}: {error}",
                    original_name
                );
                return Err(IpcError::Internal(
                    "Unable to stage imported files for the project.".into(),
                )
                .into());
            }
        };
        let destination_path = project_root.join(&candidate_name);
        if let Err(error) = fs::copy(source_path, &destination_path).await {
            error!(
                target: "ipc::projects",
                "failed to copy file {:?} -> {:?}: {error}",
                source_path,
                destination_path
            );
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
            original_name: original_name.to_string(),
            original_path: source_path.display().to_string(),
            stored_rel_path,
            ext: extension.to_string(),
            size_bytes,
            checksum_sha256: None,
            import_status: ProjectFileImportStatus::Imported,
        });
    }

    let inserted = db.add_files_to_project(project_id, &imported_files).await?;

    let inserted_dtos = inserted
        .into_iter()
        .map(|file| project_file_to_dto(&file))
        .collect::<Vec<_>>();

    Ok(AddFilesResponseDto {
        inserted: inserted_dtos,
        inserted_count: imported_files.len(),
    })
}

/// Removes a file from a project, cleans up any associated conversion
/// artifacts, and deletes the metadata.
#[tauri::command]
pub async fn remove_project_file(
    db: State<'_, DbManager>,
    project_id: Uuid,
    project_file_id: Uuid,
) -> IpcResult<u64> {
    let details = db.list_project_details(project_id).await?;
    let root_path = PathBuf::from(&details.root_path);

    // Retain a snapshot of the target file entry before we delete the row so we
    // can clean up the derived artifacts afterwards.
    let target = details
        .files
        .iter()
        .find(|f| f.file.id.to_string() == project_file_id.to_string())
        .cloned();

    let removed = db.remove_project_file(project_id, project_file_id).await?;

    if let Some(entry) = target {
        remove_relative_artifact(&root_path, &entry.file.stored_rel_path, "project file").await;

        for conv in entry.conversions {
            if let Some(rel) = conv.xliff_rel_path {
                remove_relative_artifact(&root_path, &rel, "xliff artifact").await;
            }

            if let Some(rel) = conv.jliff_rel_path {
                remove_relative_artifact(&root_path, &rel, "jliff artifact").await;
            }

            if let Some(rel) = conv.tag_map_rel_path {
                remove_relative_artifact(&root_path, &rel, "tag map artifact").await;
            }
        }
    }

    Ok(removed)
}

/// Deletes an entire project, including the project directory on disk if it is
/// still present. The operation tolerates missing directories to support manual
/// user cleanup.
#[tauri::command]
pub async fn delete_project(db: State<'_, DbManager>, project_id: Uuid) -> IpcResult<u64> {
    let root = match db.project_root_path(project_id).await {
        Ok(path) => Some(path),
        Err(err) => {
            // If the project isn't found, attempt DB delete anyway.
            warn!(
                target: "ipc::projects",
                "failed to resolve project root path before deletion: {err}"
            );
            None
        }
    };

    let deleted = db.delete_project(project_id).await?;

    if deleted > 0 {
        if let Some(root_path) = root {
            match fs::remove_dir_all(&root_path).await {
                Ok(_) => {}
                Err(error) if error.kind() == ErrorKind::NotFound => {}
                Err(error) => {
                    warn!(
                        target: "ipc::projects",
                        "failed to remove project directory {:?}: {error}",
                        root_path
                    );
                }
            }
        }
    }

    Ok(deleted)
}

/// Builds a conversion plan for every file that still needs an XLIFF artefact.
/// The UI consumes this plan to schedule background conversions.
#[tauri::command]
pub async fn ensure_project_conversions_plan(
    db: State<'_, DbManager>,
    project_id: Uuid,
) -> IpcResult<EnsureConversionsPlanDto> {
    let details = db.list_project_details(project_id).await?;
    let project_src_lang = details
        .default_src_lang
        .clone()
        .unwrap_or_else(|| "en-US".to_string());
    let project_tgt_lang = details
        .default_tgt_lang
        .clone()
        .unwrap_or_else(|| "it-IT".to_string());
    // Default to XLIFF 2.0 (supported by toolchain and DB schema).
    let version = "2.0".to_string();

    let root_path = PathBuf::from(&details.root_path);
    let xliff_dir = DbManager::ensure_subdir(&root_path, "xliff")?;

    let mut tasks = Vec::new();
    let mut file_map = HashMap::new();

    for file in &details.files {
        file_map.insert(file.file.id.to_string(), file.file.clone());
    }

    for row in details
        .files
        .iter()
        .flat_map(|file| &file.conversions)
        .filter(|row| row.xliff_rel_path.is_none())
    {
        let src_lang = if row.src_lang.trim().is_empty() {
            project_src_lang.clone()
        } else {
            row.src_lang.clone()
        };
        let tgt_lang = if row.tgt_lang.trim().is_empty() {
            project_tgt_lang.clone()
        } else {
            row.tgt_lang.clone()
        };

        if let Some(f) = file_map.get(&row.project_file_id.to_string()) {
            let input_abs_path = root_path.join(&f.stored_rel_path);
            // derive output file name: <stem>.<src>-<tgt>.xlf
            let stem = Path::new(&f.stored_rel_path)
                .file_stem()
                .and_then(OsStr::to_str)
                .unwrap_or("file");
            let target_name = format!("{}.{}-{}.xlf", stem, src_lang, tgt_lang);
            let output_abs_path = xliff_dir.join(target_name);
            tasks.push(EnsureConversionsTaskDto {
                conversion_id: row.id.to_string(),
                project_file_id: f.id.to_string(),
                input_abs_path: input_abs_path.display().to_string(),
                output_abs_path: output_abs_path.display().to_string(),
                src_lang: src_lang.clone(),
                tgt_lang: tgt_lang.clone(),
                version: version.clone(),
                paragraph: true,
                embed: true,
            });
        }
    }

    Ok(EnsureConversionsPlanDto {
        project_id: details.id.to_string(),
        src_lang: project_src_lang,
        tgt_lang: project_tgt_lang,
        version,
        tasks,
    })
}

/// Converts an XLIFF file to the JLIFF format and records the generated
/// artefacts. The heavy lifting lives inside the shared `jliff` module.
#[tauri::command]
pub async fn convert_xliff_to_jliff(
    db: State<'_, DbManager>,
    project_id: Uuid,
    conversion_id: Uuid,
    xliff_abs_path: String,
    operator: Option<String>,
    schema_abs_path: Option<String>,
) -> IpcResult<JliffConversionResultDto> {
    let details = db.list_project_details(project_id).await?;
    let root_path = PathBuf::from(&details.root_path);

    let conversion = details
        .files
        .iter()
        .flat_map(|file| &file.conversions)
        .find(|row| row.id == conversion_id)
        .ok_or_else(|| IpcError::Validation("Conversion was not found for project.".into()))?;

    let jliff_dir = DbManager::ensure_subdir(&root_path, "jliff")?;

    let operator = operator
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .unwrap_or_else(|| "Unknown operator".to_string());

    let schema_path = schema_abs_path.as_ref().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    });

    let mut options = ConversionOptions::new(
        PathBuf::from(&xliff_abs_path),
        jliff_dir.clone(),
        details.name.clone(),
        details.id.to_string(),
        operator,
    );
    options.schema_path = schema_path;

    let artifacts = convert_xliff(&options).map_err(|error| {
        error!(
            target: "ipc::projects",
            "failed to convert XLIFF to JLIFF for conversion {conversion_id}: {error}"
        );
        IpcError::Internal(format!("Failed to convert XLIFF to JLIFF: {}", error))
    })?;

    if artifacts.is_empty() {
        return Err(IpcError::Internal("No <file> element found in XLIFF document.".into()).into());
    }
    let artifact_count = artifacts.len();
    let mut artifact_iter = artifacts.into_iter();
    let artifact = artifact_iter
        .next()
        .ok_or_else(|| IpcError::Internal("JLIFF converter returned no artifacts.".into()))?;

    if artifact_count > 1 {
        warn!(
            target: "ipc::projects",
            "XLIFF produced {artifact_count} <file> elements; selecting '{file_id}' for conversion {conversion_id}",
            file_id = artifact.file_id
        );
    }

    let jliff_rel = artifact.jliff_path.strip_prefix(&root_path).map_err(|_| {
        IpcError::Internal("JLIFF output path is outside the project folder.".into())
    })?;
    let tag_map_rel = artifact
        .tag_map_path
        .strip_prefix(&root_path)
        .map_err(|_| {
            IpcError::Internal("Tag-map output path is outside the project folder.".into())
        })?;

    Ok(JliffConversionResultDto {
        file_id: conversion.project_file_id.to_string(),
        jliff_abs_path: artifact.jliff_path.to_string_lossy().to_string(),
        jliff_rel_path: jliff_rel.to_string_lossy().to_string(),
        tag_map_abs_path: artifact.tag_map_path.to_string_lossy().to_string(),
        tag_map_rel_path: tag_map_rel.to_string_lossy().to_string(),
    })
}

/// Convenience wrapper around `read_project_artifact_impl` so the front-end can
/// read arbitrary project artefacts by relative path.
#[tauri::command]
pub async fn read_project_artifact(
    db: State<'_, DbManager>,
    project_id: Uuid,
    rel_path: String,
) -> IpcResult<String> {
    read_project_artifact_impl(&db, project_id, &rel_path)
        .await
        .map_err(InvokeError::from)
}

/// Updates the translated text for a single `trans-unit` in a JLIFF document.
/// We take a write lock on the artefact to prevent concurrent writes.
#[tauri::command]
pub async fn update_jliff_segment(
    db: State<'_, DbManager>,
    project_id: Uuid,
    jliff_rel_path: String,
    transunit_id: String,
    new_target: String,
) -> IpcResult<UpdateJliffSegmentResultDto> {
    update_jliff_segment_impl(&db, project_id, &jliff_rel_path, &transunit_id, new_target)
        .await
        .map_err(InvokeError::from)
}

/// Persists status information for a conversion job. The timestamps are derived
/// locally because the conversion pipeline currently runs in-process.
#[tauri::command]
pub async fn update_conversion_status(
    db: State<'_, DbManager>,
    conversion_id: Uuid,
    status: String,
    xliff_rel_path: Option<String>,
    jliff_rel_path: Option<String>,
    tag_map_rel_path: Option<String>,
    error_message: Option<String>,
) -> IpcResult<()> {
    use crate::db::ProjectFileConversionStatus as S;
    let parsed = match status.as_str() {
        "pending" => S::Pending,
        "running" => S::Running,
        "completed" => S::Completed,
        "failed" => S::Failed,
        _ => return Err(IpcError::Validation("Invalid conversion status.".into()).into()),
    };

    let ts = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc().to_string());
    let (started_at, completed_at, failed_at) = match parsed {
        S::Running => (Some(ts), None, None),
        S::Completed => (None, Some(ts), None),
        S::Failed => (None, None, Some(ts)),
        S::Pending => (None, None, None),
    };

    db.upsert_conversion_status(
        conversion_id,
        parsed,
        xliff_rel_path,
        jliff_rel_path,
        tag_map_rel_path,
        error_message,
        started_at,
        completed_at,
        failed_at,
    )
    .await?;
    Ok(())
}

/// Lists projects with basic metadata for the dashboard view.
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

/// Reads the contents of a project artefact while ensuring callers cannot
/// escape the project directory. This helper is reused by tests for direct
/// filesystem verification.
pub async fn read_project_artifact_impl(
    db: &DbManager,
    project_id: Uuid,
    rel_path: &str,
) -> Result<String, IpcError> {
    let root = project_root(db, project_id).await?;
    let artifact_path = resolve_project_relative_path(&root, rel_path, "resolve project artifact")?;

    fs::read_to_string(&artifact_path).await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return IpcError::Validation(format!(
                "Artifact '{rel_path}' was not found for the requested project."
            ));
        }
        error!(
            target: "ipc::projects",
            "failed to read project artifact {}: {error}",
            artifact_path.display()
        );
        fs_error("read project artifact", error)
    })
}

/// Internal implementation for `update_jliff_segment` allowing unit tests to
/// exercise the logic without going through Tauri's IPC layer.
pub async fn update_jliff_segment_impl(
    db: &DbManager,
    project_id: Uuid,
    jliff_rel_path: &str,
    transunit_id: &str,
    new_target: String,
) -> Result<UpdateJliffSegmentResultDto, IpcError> {
    let root = project_root(db, project_id).await?;
    let artifact_path = resolve_project_relative_path(&root, jliff_rel_path, "resolve JLIFF path")?;
    let transunit_id = transunit_id.to_owned();
    let new_target_value = new_target;
    let path_for_lock = artifact_path.clone();

    with_project_file_lock(&artifact_path, move || {
        let artifact_path = path_for_lock.clone();
        let transunit_id = transunit_id.clone();
        let new_target = new_target_value.clone();
        async move {
            let current = fs::read_to_string(&artifact_path).await.map_err(|error| {
                if error.kind() == ErrorKind::NotFound {
                    return IpcError::Validation(format!(
                        "JLIFF document '{jliff_rel_path}' was not found for the requested project."
                    ));
                }
                error!(
                    target: "ipc::projects",
                    "failed to read JLIFF document {}: {error}",
                    artifact_path.display()
                );
                fs_error("read JLIFF document", error)
            })?;

            let mut document: JliffDocument = serde_json::from_str(&current).map_err(|error| {
                error!(
                    target: "ipc::projects",
                    "failed to parse JLIFF document {}: {error}",
                    artifact_path.display()
                );
                IpcError::Internal("Stored JLIFF document is corrupted.".into())
            })?;

            let mut updated_count = 0usize;

            for unit in &mut document.transunits {
                if unit.transunit_id == transunit_id {
                    unit.target_translation = new_target.clone();
                    updated_count += 1;
                }
            }

            if updated_count == 0 {
                return Err(IpcError::Validation(format!(
                    "Translation unit '{transunit_id}' was not found in the provided JLIFF document."
                )));
            }

            let serialized = serde_json::to_string_pretty(&document).map_err(|error| {
                error!(
                    target: "ipc::projects",
                    "failed to serialize updated JLIFF document {}: {error}",
                    artifact_path.display()
                );
                IpcError::Internal("Failed to serialise updated translation segment.".into())
            })?;

            fs::write(&artifact_path, serialized).await.map_err(|error| {
                error!(
                    target: "ipc::projects",
                    "failed to write updated JLIFF document {}: {error}",
                    artifact_path.display()
                );
                fs_error("write JLIFF document", error)
            })?;

            let updated_at = time::OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc().to_string());

            Ok(UpdateJliffSegmentResultDto {
                updated_count,
                updated_at,
            })
        }
    })
    .await
}

/// Resolves and canonicalises the project root directory from the database so
/// subsequent filesystem operations can rely on absolute paths.
async fn project_root(db: &DbManager, project_id: Uuid) -> Result<PathBuf, IpcError> {
    let details = db
        .list_project_details(project_id)
        .await
        .map_err(IpcError::from)?;
    let root = PathBuf::from(&details.root_path);
    match std::fs::canonicalize(&root) {
        Ok(path) => Ok(path),
        Err(error) => {
            error!(
                target: "ipc::projects",
                "failed to canonicalize project root {}: {error}",
                root.display()
            );
            Err(fs_error("resolve project root", error))
        }
    }
}

/// Validates a relative artefact path to ensure it stays within the project
/// root before returning the canonical absolute path.
fn resolve_project_relative_path(
    root: &Path,
    rel_path: &str,
    action: &str,
) -> Result<PathBuf, IpcError> {
    let trimmed = rel_path.trim();
    if trimmed.is_empty() {
        return Err(IpcError::Validation(
            "Artifact path cannot be empty.".into(),
        ));
    }

    let rel = Path::new(trimmed);
    if rel.is_absolute() {
        return Err(IpcError::Validation(
            "Artifact path must be relative to the project root.".into(),
        ));
    }

    for component in rel.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        ) {
            return Err(IpcError::Validation(
                "Artifact path cannot traverse outside the project root.".into(),
            ));
        }
    }

    let candidate = root.join(rel);
    match std::fs::canonicalize(&candidate) {
        Ok(path) => {
            if !path.starts_with(root) {
                return Err(IpcError::Validation(
                    "Artifact path resolves outside the project root.".into(),
                ));
            }
            Ok(path)
        }
        Err(error) => {
            if error.kind() == ErrorKind::NotFound {
                return Err(IpcError::Validation(format!(
                    "Artifact '{}' was not found for the requested project.",
                    rel_path
                )));
            }
            error!(
                target: "ipc::projects",
                "failed to canonicalize artifact path {}: {error}",
                candidate.display()
            );
            Err(fs_error(action, error))
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

fn project_list_item_to_dto(project: ProjectListItem) -> ProjectListItemDto {
    ProjectListItemDto {
        project_id: project.id.to_string(),
        name: project.name,
        slug: project.slug,
        project_type: project.project_type.as_str().to_string(),
        status: project.status.as_str().to_string(),
        activity_status: project.activity_status,
        file_count: project.file_count,
        created_at: project.created_at,
        updated_at: project.updated_at,
    }
}

fn project_details_to_dto(details: &ProjectDetails) -> ProjectDetailsDto {
    let files = details
        .files
        .iter()
        .map(|f| ProjectFileWithConversionsDto {
            file: project_file_to_dto(&f.file),
            conversions: f
                .conversions
                .iter()
                .map(project_file_conversion_to_dto)
                .collect(),
        })
        .collect();
    ProjectDetailsDto {
        id: details.id.to_string(),
        name: details.name.clone(),
        slug: details.slug.clone(),
        default_src_lang: details.default_src_lang.clone(),
        default_tgt_lang: details.default_tgt_lang.clone(),
        root_path: details.root_path.clone(),
        files,
    }
}

fn project_file_to_dto(file: &ProjectFileDetails) -> ProjectFileDto {
    ProjectFileDto {
        id: file.id.to_string(),
        original_name: file.original_name.clone(),
        stored_rel_path: file.stored_rel_path.clone(),
        ext: file.ext.clone(),
        size_bytes: file.size_bytes,
        import_status: file.import_status.as_str().to_string(),
        created_at: file.created_at.clone(),
        updated_at: file.updated_at.clone(),
    }
}

fn project_file_conversion_to_dto(row: &ProjectFileConversionRow) -> ProjectFileConversionDto {
    ProjectFileConversionDto {
        id: row.id.to_string(),
        project_file_id: row.project_file_id.to_string(),
        src_lang: row.src_lang.clone(),
        tgt_lang: row.tgt_lang.clone(),
        version: row.version.clone(),
        paragraph: row.paragraph,
        embed: row.embed,
        xliff_rel_path: row.xliff_rel_path.clone(),
        jliff_rel_path: row.jliff_rel_path.clone(),
        tag_map_rel_path: row.tag_map_rel_path.clone(),
        status: row.status.as_str().to_string(),
        started_at: row.started_at.clone(),
        completed_at: row.completed_at.clone(),
        failed_at: row.failed_at.clone(),
        error_message: row.error_message.clone(),
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
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

async fn remove_relative_artifact(root_path: &Path, rel_path: &str, label: &str) {
    if rel_path.trim().is_empty() {
        return;
    }

    let Some(full_path) = join_within_project(root_path, rel_path) else {
        warn!(
            target: "ipc::projects",
            "skipping cleanup for {} with unsafe path '{}'",
            label,
            rel_path
        );
        return;
    };

    remove_file_and_cleanup(&full_path, root_path, label).await;
}

async fn remove_file_and_cleanup(path: &Path, root_path: &Path, label: &str) {
    match fs::remove_file(path).await {
        Ok(()) => cleanup_empty_parents(path.parent(), root_path).await,
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            warn!(
                target: "ipc::projects",
                "failed to remove {} {:?}: {}",
                label,
                path,
                error
            );
        }
    }
}

async fn cleanup_empty_parents(mut current: Option<&Path>, root_path: &Path) {
    while let Some(dir) = current {
        if dir == root_path || !dir.starts_with(root_path) {
            break;
        }

        match fs::remove_dir(dir).await {
            Ok(()) => {
                current = dir.parent();
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                current = dir.parent();
            }
            Err(error) if error.kind() == ErrorKind::DirectoryNotEmpty => break,
            Err(error) => {
                warn!(
                    target: "ipc::projects",
                    "failed to cleanup directory {:?}: {}",
                    dir,
                    error
                );
                break;
            }
        }
    }
}

fn join_within_project(root_path: &Path, rel_path: &str) -> Option<PathBuf> {
    let rel = Path::new(rel_path.trim());
    if rel.as_os_str().is_empty() || rel.is_absolute() {
        return None;
    }

    if rel.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return None;
    }

    let candidate = root_path.join(rel);
    if candidate.starts_with(root_path) {
        Some(candidate)
    } else {
        None
    }
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

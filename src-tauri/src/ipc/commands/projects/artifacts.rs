//! Project artifact management for XLIFF and JLIFF operations
//!
//! This module handles operations on translation artifacts including:
//! - Reading and writing project artifacts
//! - XLIFF to JLIFF conversion coordination
//! - JLIFF document manipulation and updates
//! - Artifact path resolution and security validation

use std::collections::HashMap;
use std::convert::TryFrom;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use log::{error, warn};
use serde::Serialize;
use serde_json::json;
use sqlx::Row;
use tokio::fs;
use uuid::Uuid;

use super::constants::{
    DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_XLIFF_VERSION, PROJECT_DIR_ARTIFACTS,
    PROJECT_DIR_ARTIFACTS_XJLIFF, PROJECT_DIR_ARTIFACTS_XLIFF,
};
use super::file_operations::compute_sha256_streaming;
use super::utils::{
    build_language_directory_name, join_within_project, resolve_project_relative_path,
};
use crate::db::{
    ArtifactKind, ArtifactStatus, DbManager, FileTargetStatus, ProjectFileConversionRequest,
};
use crate::ipc::commands::shared::{fs_error, with_project_file_lock};
use crate::ipc::dto::{EnsureConversionsPlanDto, FileIntegrityAlertDto};
use crate::ipc::error::IpcError;
use crate::jliff::{ConversionOptions, JliffDocument, convert_xliff};

/// Result of JLIFF conversion operations
///
/// Contains paths and metadata for successfully converted JLIFF artifacts
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JliffConversionResult {
    /// ID of the project file that was converted
    pub file_id: String,
    /// Absolute path to the generated JLIFF document
    pub jliff_abs_path: String,
    /// Relative path to the JLIFF document (within project)
    pub jliff_rel_path: String,
    /// Absolute path to the generated tag mapping file
    pub tag_map_abs_path: String,
    /// Relative path to the tag mapping file (within project)
    pub tag_map_rel_path: String,
}

/// Result of JLIFF segment update operations
///
/// Contains information about successful translation updates
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJliffSegmentResult {
    /// Number of translation units that were updated
    pub updated_count: usize,
    /// ISO 8601 timestamp when the update was performed
    pub updated_at: String,
}

/// Reads a project artifact file by relative path
///
/// This function safely reads project artifacts while ensuring the
/// requested path cannot escape the project directory boundaries.
/// It's used for reading JLIFF files, XLIFF files, and other project
/// artifacts from the frontend.
///
/// # Arguments
/// * `db` - Database manager for project lookup
/// * `project_id` - UUID of the project containing the artifact
/// * `rel_path` - Relative path to the artifact within the project
///
/// # Returns
/// Contents of the artifact file as a UTF-8 string
///
/// # Errors
/// - `IpcError::Validation` if the path is invalid or file not found
/// - `IpcError::Internal` if filesystem operations fail
///
/// # Security
/// This function validates that the relative path stays within the
/// project directory to prevent directory traversal attacks.
pub async fn read_project_artifact(
    db: &DbManager,
    project_id: Uuid,
    rel_path: &str,
) -> Result<String, IpcError> {
    // Get and validate project root
    let root = get_project_root(db, project_id).await?;

    // Resolve and validate the artifact path
    let artifact_path = resolve_project_relative_path(&root, rel_path, "resolve project artifact")?;

    // Read the file contents
    fs::read_to_string(&artifact_path).await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return IpcError::Validation(format!(
                "Artifact '{rel_path}' was not found for the requested project."
            ));
        }
        error!(
            target: "ipc::projects::artifacts",
            "failed to read project artifact {}: {error}",
            artifact_path.display()
        );
        fs_error("read project artifact", error)
    })
}

/// Updates a translation segment in a JLIFF document
///
/// This function safely updates a single translation unit in a JLIFF
/// document using file locking to prevent concurrent modifications.
/// It parses the JSON, updates the target translation, and writes
/// the modified document back to disk.
///
/// # Arguments
/// * `db` - Database manager for project lookup
/// * `project_id` - UUID of the project containing the JLIFF
/// * `jliff_rel_path` - Relative path to the JLIFF file
/// * `transunit_id` - ID of the translation unit to update
/// * `new_target` - New translation text for the segment
///
/// # Returns
/// Information about the update operation including count and timestamp
///
/// # Errors
/// - `IpcError::Validation` if file not found or transunit not found
/// - `IpcError::Internal` if JSON parsing or filesystem operations fail
///
/// # Concurrency Safety
/// Uses file-level locking to prevent concurrent updates to the same
/// JLIFF document, ensuring data integrity during simultaneous edits.
pub async fn update_jliff_segment(
    db: &DbManager,
    project_id: Uuid,
    jliff_rel_path: &str,
    transunit_id: &str,
    new_target: String,
) -> Result<UpdateJliffSegmentResult, IpcError> {
    let root = get_project_root(db, project_id).await?;
    let artifact_path = resolve_project_relative_path(&root, jliff_rel_path, "resolve JLIFF path")?;

    let transunit_id = transunit_id.to_owned();
    let new_target_value = new_target;
    let path_for_lock = artifact_path.clone();

    with_project_file_lock(&artifact_path, move || {
        let artifact_path = path_for_lock.clone();
        let transunit_id = transunit_id.clone();
        let new_target = new_target_value.clone();

        async move {
            // Read current JLIFF document
            let current_content = fs::read_to_string(&artifact_path).await.map_err(|error| {
                if error.kind() == ErrorKind::NotFound {
                    return IpcError::Validation(format!(
                        "JLIFF document '{jliff_rel_path}' was not found for the requested project."
                    ));
                }
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to read JLIFF document {}: {error}",
                    artifact_path.display()
                );
                fs_error("read JLIFF document", error)
            })?;

            // Parse JLIFF document
            let mut document: JliffDocument = serde_json::from_str(&current_content).map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to parse JLIFF document {}: {error}",
                    artifact_path.display()
                );
                IpcError::Internal("Stored JLIFF document is corrupted.".into())
            })?;

            // Update matching translation units
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

            // Serialize updated document
            let serialized = serde_json::to_string_pretty(&document).map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to serialize updated JLIFF document {}: {error}",
                    artifact_path.display()
                );
                IpcError::Internal("Failed to serialise updated translation segment.".into())
            })?;

            // Write updated document
            fs::write(&artifact_path, serialized).await.map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to write updated JLIFF document {}: {error}",
                    artifact_path.display()
                );
                fs_error("write JLIFF document", error)
            })?;

            // Generate timestamp for response
            let updated_at = time::OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc().to_string());

            Ok(UpdateJliffSegmentResult {
                updated_count,
                updated_at,
            })
        }
    })
    .await
}

/// Converts an XLIFF file to JLIFF format
///
/// This function orchestrates the conversion of an XLIFF document to
/// the internal JLIFF format used by the application. It handles
/// multiple file elements in XLIFF documents and generates both
/// JLIFF content and tag mapping artifacts.
///
/// # Arguments
/// * `db` - Database manager for project operations
/// * `project_id` - UUID of the project
/// * `conversion_id` - UUID of the conversion record
/// * `xliff_abs_path` - Absolute path to the source XLIFF file
/// * `operator` - Optional operator name for metadata
/// * `schema_abs_path` - Optional path to JLIFF schema for validation
///
/// # Returns
/// Information about the generated JLIFF artifacts
///
/// # Errors
/// - `IpcError::Validation` if conversion not found or no file elements
/// - `IpcError::Internal` if XLIFF conversion fails or paths are invalid
///
/// # Generated Artifacts
/// - JLIFF document: JSON representation of translatable content
/// - Tag mapping: Mapping between inline tags and their representations
pub async fn convert_xliff_to_jliff(
    db: &DbManager,
    project_id: Uuid,
    conversion_id: Uuid,
    xliff_abs_path: String,
    operator: Option<String>,
    schema_abs_path: Option<String>,
) -> Result<JliffConversionResult, IpcError> {
    let details = db.list_project_details(project_id).await?;
    let root_path = PathBuf::from(&details.root_path);

    // Find the conversion record
    let conversion = details
        .files
        .iter()
        .flat_map(|file| &file.conversions)
        .find(|row| row.id == conversion_id)
        .ok_or_else(|| IpcError::Validation("Conversion was not found for project.".into()))?;

    let src_lang = if conversion.src_lang.trim().is_empty() {
        details
            .default_src_lang
            .clone()
            .unwrap_or_else(|| DEFAULT_SOURCE_LANGUAGE.to_string())
    } else {
        conversion.src_lang.clone()
    };
    let tgt_lang = if conversion.tgt_lang.trim().is_empty() {
        details
            .default_tgt_lang
            .clone()
            .unwrap_or_else(|| DEFAULT_TARGET_LANGUAGE.to_string())
    } else {
        conversion.tgt_lang.clone()
    };

    let artifacts_root = DbManager::ensure_subdir(&root_path, PROJECT_DIR_ARTIFACTS)?;
    let jliff_root =
        DbManager::ensure_subdir(artifacts_root.as_path(), PROJECT_DIR_ARTIFACTS_XJLIFF)?;
    let pair_dir_name = build_language_directory_name(&src_lang, &tgt_lang);
    let jliff_dir = DbManager::ensure_subdir(jliff_root.as_path(), &pair_dir_name)?;

    // Process operator parameter
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

    // Process optional schema path
    let schema_path = schema_abs_path.as_ref().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    });

    // Set up conversion options
    let mut options = ConversionOptions::new(
        PathBuf::from(&xliff_abs_path),
        jliff_dir.clone(),
        details.name.clone(),
        details.id.to_string(),
        operator,
    );
    options.file_prefix = Some(conversion.project_file_id.to_string());
    options.schema_path = schema_path;

    let file_target_id = db
        .find_file_target(project_id, conversion.project_file_id, &src_lang, &tgt_lang)
        .await
        .map_err(IpcError::from)?;

    // Perform XLIFF to JLIFF conversion
    let artifacts = match convert_xliff(&options) {
        Ok(artifacts) => artifacts,
        Err(error) => {
            let message = format!("Failed to convert XLIFF to JLIFF: {error}");
            error!(
                target: "ipc::projects::artifacts",
                "failed to convert XLIFF to JLIFF for conversion {conversion_id}: {error}"
            );
            if let Some(file_target_id) = file_target_id {
                let job_key = format!("CONVERT_JLIFF::{}::{}", project_id, file_target_id);
                if let Err(job_error) = db
                    .insert_job_row(
                        "CONVERT_JLIFF",
                        project_id,
                        "FAILED",
                        Some(file_target_id),
                        None,
                        Some(message.as_str()),
                        1,
                        job_key.as_str(),
                    )
                    .await
                {
                    warn!(
                        target: "ipc::projects::artifacts",
                        "failed to log CONVERT_JLIFF failure for conversion {conversion_id}: {job_error}"
                    );
                }
            }
            return Err(IpcError::Internal(message));
        }
    };

    if artifacts.is_empty() {
        return Err(IpcError::Internal("No <file> element found in XLIFF document.".into()).into());
    }

    let artifact_count = artifacts.len();
    let mut artifact_iter = artifacts.into_iter();
    let artifact = artifact_iter
        .next()
        .ok_or_else(|| IpcError::Internal("JLIFF converter returned no artifacts.".into()))?;

    if artifact_count > 1 {
        log::warn!(
            target: "ipc::projects::artifacts",
            "XLIFF produced {artifact_count} <file> elements; selecting '{file_id}' for conversion {conversion_id}",
            file_id = artifact.file_id
        );
    }

    // Calculate relative paths for database storage
    let jliff_rel = artifact.jliff_path.strip_prefix(&root_path).map_err(|_| {
        IpcError::Internal("JLIFF output path is outside the project folder.".into())
    })?;
    let tag_map_rel = artifact
        .tag_map_path
        .strip_prefix(&root_path)
        .map_err(|_| {
            IpcError::Internal("Tag-map output path is outside the project folder.".into())
        })?;

    let jliff_rel_string = jliff_rel.to_string_lossy().to_string();
    let tag_map_rel_string = tag_map_rel.to_string_lossy().to_string();

    if let Some(file_target_id) = file_target_id {
        let job_key = format!("CONVERT_JLIFF::{}::{}", project_id, file_target_id);
        let metadata = match fs::metadata(&artifact.jliff_path).await {
            Ok(data) => Some(data),
            Err(error) => {
                warn!(
                    target: "ipc::projects::artifacts",
                    "failed to inspect JLIFF artifact {:?}: {error}; persisting without size metadata",
                    artifact.jliff_path
                );
                None
            }
        };

        let artifact_size = metadata.and_then(|meta| match i64::try_from(meta.len()) {
            Ok(value) => Some(value),
            Err(_) => {
                warn!(
                    target: "ipc::projects::artifacts",
                    "JLIFF artifact {} exceeds i64 range; persisting without size metadata",
                    jliff_rel_string
                );
                None
            }
        });

        match db
            .upsert_artifact(
                file_target_id,
                ArtifactKind::Jliff,
                &jliff_rel_string,
                artifact_size,
                None,
                Some("OpenXLIFF"),
                ArtifactStatus::Generated,
            )
            .await
        {
            Ok(artifact_record) => {
                let artifact_id = artifact_record.artifact_id;
                if let Some(summary) = artifact.validation.as_ref() {
                    let payload = json!({
                        "schemaPath": summary.schema_path,
                        "skipped": summary.skipped,
                        "message": summary.message,
                    });

                    if let Err(validation_error) = db
                        .insert_validation_record(
                            artifact_id,
                            &summary.validator,
                            summary.passed,
                            Some(&payload),
                        )
                        .await
                    {
                        warn!(
                            target: "ipc::projects::artifacts",
                            "failed to persist validation record for artifact {artifact_id}: {validation_error}"
                        );
                    }
                }

                db.update_file_target_status(file_target_id, FileTargetStatus::Extracted)
                    .await
                    .map_err(IpcError::from)?;

                if let Err(job_error) = db
                    .insert_job_row(
                        "CONVERT_JLIFF",
                        project_id,
                        "SUCCEEDED",
                        Some(file_target_id),
                        Some(artifact_id),
                        None,
                        1,
                        job_key.as_str(),
                    )
                    .await
                {
                    warn!(
                        target: "ipc::projects::artifacts",
                        "failed to log CONVERT_JLIFF success for conversion {conversion_id}: {job_error}"
                    );
                }
            }
            Err(db_error) => {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to upsert JLIFF artifact metadata for conversion {conversion_id}: {db_error}"
                );
            }
        }
    } else {
        warn!(
            target: "ipc::projects::artifacts",
            "conversion {conversion_id} generated JLIFF but no file_target exists for {src_lang}->{tgt_lang}; skipping artifact persistence"
        );
    }

    Ok(JliffConversionResult {
        file_id: conversion.project_file_id.to_string(),
        jliff_abs_path: artifact.jliff_path.to_string_lossy().to_string(),
        jliff_rel_path: jliff_rel_string,
        tag_map_abs_path: artifact.tag_map_path.to_string_lossy().to_string(),
        tag_map_rel_path: tag_map_rel_string,
    })
}

/// Builds a conversion plan for project files requiring XLIFF generation
///
/// This function analyzes project files and their conversion records to
/// determine which files need XLIFF conversion. It generates a plan with
/// all necessary parameters for batch conversion operations.
///
/// # Arguments
/// * `db` - Database manager for project data access
/// * `project_id` - UUID of the project to plan conversions for
///
/// # Returns
/// Conversion plan with tasks for files needing XLIFF generation
///
/// # Plan Generation
/// The function:
/// 1. Loads project details and default languages
/// 2. Creates XLIFF output directory structure
/// 3. Identifies conversions without XLIFF artifacts
/// 4. Generates conversion tasks with proper file naming
/// 5. Uses project defaults for missing language parameters
pub async fn build_conversions_plan(
    db: &DbManager,
    project_id: Uuid,
) -> Result<EnsureConversionsPlanDto, IpcError> {
    let details = db.list_project_details(project_id).await?;

    // Use project defaults or fallback values
    let project_src_lang = details
        .default_src_lang
        .clone()
        .unwrap_or_else(|| DEFAULT_SOURCE_LANGUAGE.to_string());
    let project_tgt_lang = details
        .default_tgt_lang
        .clone()
        .unwrap_or_else(|| DEFAULT_TARGET_LANGUAGE.to_string());
    let version = DEFAULT_XLIFF_VERSION.to_string();

    let root_path = PathBuf::from(&details.root_path);
    let artifacts_root = DbManager::ensure_subdir(&root_path, PROJECT_DIR_ARTIFACTS)?;
    let xliff_root =
        DbManager::ensure_subdir(artifacts_root.as_path(), PROJECT_DIR_ARTIFACTS_XLIFF)?;

    let file_lookup = super::dto_mappers::create_file_id_map(&details);

    let pool = db.pool().await;
    let project_id_str = project_id.to_string();
    let file_target_rows = sqlx::query(
        "SELECT
             ft.file_target_id,
             ft.file_id,
             ft.status,
             lp.src_lang,
             lp.trg_lang,
             pf.stored_rel_path,
             pf.hash_sha256
         FROM file_targets ft
         INNER JOIN project_language_pairs lp ON lp.pair_id = ft.pair_id
         INNER JOIN project_files pf ON pf.id = ft.file_id
         WHERE pf.project_id = ?1
         ORDER BY pf.created_at ASC",
    )
    .bind(&project_id_str)
    .fetch_all(&pool)
    .await
    .map_err(|error| {
        error!(
            target: "ipc::projects::artifacts",
            "failed to fetch file targets for project {project_id}: {error}"
        );
        IpcError::Internal("Unable to load file targets for conversion planning.".into())
    })?;

    let mut hash_cache: HashMap<Uuid, Option<String>> = HashMap::new();
    let mut integrity_alerts: Vec<FileIntegrityAlertDto> = Vec::new();

    if !file_target_rows.is_empty() {
        let mut tasks = Vec::new();

        for row in file_target_rows {
            let status_raw: String = row.try_get::<String, _>("status").map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to read file target status for project {project_id}: {error}"
                );
                IpcError::Internal("Corrupted file target data.".into())
            })?;
            let status = FileTargetStatus::from_str(&status_raw).ok_or_else(|| {
                error!(
                    target: "ipc::projects::artifacts",
                    "invalid file target status '{status_raw}' for project {project_id}"
                );
                IpcError::Internal("Corrupted file target data.".into())
            })?;

            if matches!(status, FileTargetStatus::Extracted) {
                continue;
            }

            let file_id_str: String = row.try_get::<String, _>("file_id").map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to read file target file_id for project {project_id}: {error}"
                );
                IpcError::Internal("Corrupted file target data.".into())
            })?;

            let file_id = Uuid::parse_str(&file_id_str).map_err(|parse_error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "invalid file_id '{file_id_str}' in file_targets for project {project_id}: {parse_error}"
                );
                IpcError::Internal("Corrupted file target data.".into())
            })?;

            let mut src_lang: String = row
                .try_get::<String, _>("src_lang")
                .map_err(|error| {
                    error!(
                        target: "ipc::projects::artifacts",
                        "failed to read file target source language for project {project_id}: {error}"
                    );
                    IpcError::Internal("Corrupted file target data.".into())
                })?
                .trim()
                .to_string();

            if src_lang.is_empty() {
                src_lang = project_src_lang.clone();
            }

            let mut tgt_lang: String = row
                .try_get::<String, _>("trg_lang")
                .map_err(|error| {
                    error!(
                        target: "ipc::projects::artifacts",
                        "failed to read file target target language for project {project_id}: {error}"
                    );
                    IpcError::Internal("Corrupted file target data.".into())
                })?
                .trim()
                .to_string();

            if tgt_lang.is_empty() {
                tgt_lang = project_tgt_lang.clone();
            }

            let stored_rel_path: String = row
                .try_get::<String, _>("stored_rel_path")
                .map_err(|error| {
                    error!(
                        target: "ipc::projects::artifacts",
                        "failed to read stored_rel_path for file target ({file_id}) in project {project_id}: {error}"
                    );
                    IpcError::Internal("Corrupted file target data.".into())
                })?;

            if stored_rel_path.trim().is_empty() {
                warn!(
                    target: "ipc::projects::artifacts",
                    "skipping file target for file {file_id} in project {project_id} due to empty stored path"
                );
                continue;
            }

            let expected_hash = row
            .try_get::<Option<String>, _>("hash_sha256")
            .map_err(|error| {
                error!(
                    target: "ipc::projects::artifacts",
                    "failed to read hash for file target ({file_id}) in project {project_id}: {error}"
                );
                IpcError::Internal("Corrupted file target data.".into())
            })?
            .and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_ascii_lowercase())
                }
            });

            if let Some(ref expected_hash) = expected_hash {
                if let Some(actual_hash) = cached_file_hash(
                    &mut hash_cache,
                    file_id,
                    root_path.as_path(),
                    &stored_rel_path,
                )
                .await
                {
                    if actual_hash != *expected_hash {
                        warn!(
                            target: "ipc::projects::artifacts",
                            "stored hash mismatch for file {file_id} in project {project_id}: expected={} actual={}",
                            expected_hash,
                            actual_hash
                        );
                        let file_name = file_lookup
                            .get(&file_id.to_string())
                            .map(|details| details.original_name.clone())
                            .unwrap_or_else(|| stored_rel_path.clone());
                        integrity_alerts.push(FileIntegrityAlertDto {
                            file_id: file_id.to_string(),
                            file_name,
                            expected_hash: expected_hash.clone(),
                            actual_hash: actual_hash.clone(),
                        });
                    }
                }
            }

            let conversion_request =
                ProjectFileConversionRequest::new(&src_lang, &tgt_lang, &version);
            let conversion = db
                .find_or_create_conversion_for_file(file_id, &conversion_request)
                .await
                .map_err(IpcError::from)?;

            if conversion.xliff_rel_path.is_some() && !matches!(status, FileTargetStatus::Failed) {
                warn!(
                    target: "ipc::projects::artifacts",
                    "file target for file {file_id} is {} but conversion {} already has an XLIFF path; skipping",
                    status.as_str(),
                    conversion.id
                );
                continue;
            }

            let lang_dir =
                build_language_directory_name(&conversion.src_lang, &conversion.tgt_lang);
            let pair_dir = DbManager::ensure_subdir(xliff_root.as_path(), &lang_dir)?;
            let target_name = format!("{}.xlf", conversion.project_file_id);
            let output_abs_path = pair_dir.join(target_name);
            let input_abs_path =
                join_within_project(&root_path, &stored_rel_path).ok_or_else(|| {
                    IpcError::Validation(
                        "Stored file path resolves outside the project directory.".into(),
                    )
                })?;

            tasks.push(crate::ipc::dto::EnsureConversionsTaskDto {
                conversion_id: conversion.id.to_string(),
                project_file_id: conversion.project_file_id.to_string(),
                input_abs_path: input_abs_path.display().to_string(),
                output_abs_path: output_abs_path.display().to_string(),
                src_lang: conversion.src_lang.clone(),
                tgt_lang: conversion.tgt_lang.clone(),
                version: conversion.version.clone(),
                paragraph: conversion.paragraph,
                embed: conversion.embed,
            });
        }

        return Ok(EnsureConversionsPlanDto {
            project_id: details.id.to_string(),
            src_lang: project_src_lang,
            tgt_lang: project_tgt_lang,
            version,
            tasks,
            integrity_alerts,
        });
    }

    let mut tasks = Vec::new();

    // Process conversions that need XLIFF generation
    for row in details
        .files
        .iter()
        .flat_map(|file| &file.conversions)
        .filter(|row| row.xliff_rel_path.is_none())
    {
        // Use conversion-specific languages or project defaults
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

        if let Some(file_details) = file_lookup.get(&row.project_file_id.to_string()) {
            if let Some(expected_hash) = file_details.hash_sha256.as_deref().and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_ascii_lowercase())
                }
            }) {
                if let Some(actual_hash) = cached_file_hash(
                    &mut hash_cache,
                    file_details.id,
                    root_path.as_path(),
                    &file_details.stored_rel_path,
                )
                .await
                {
                    if actual_hash != expected_hash {
                        warn!(
                            target: "ipc::projects::artifacts",
                            "stored hash mismatch for file {} in project {}: expected={} actual={}",
                            file_details.id,
                            project_id,
                            expected_hash,
                            actual_hash
                        );
                        integrity_alerts.push(FileIntegrityAlertDto {
                            file_id: file_details.id.to_string(),
                            file_name: file_details.original_name.clone(),
                            expected_hash: expected_hash.clone(),
                            actual_hash: actual_hash.clone(),
                        });
                    }
                }
            }

            let input_abs_path = join_within_project(&root_path, &file_details.stored_rel_path)
                .ok_or_else(|| {
                    IpcError::Validation(
                        "Stored file path resolves outside the project directory.".into(),
                    )
                })?;
            let lang_dir = build_language_directory_name(&src_lang, &tgt_lang);
            let pair_dir = DbManager::ensure_subdir(xliff_root.as_path(), &lang_dir)?;
            let target_name = format!("{}.xlf", file_details.id);
            let output_abs_path = pair_dir.join(target_name);

            tasks.push(crate::ipc::dto::EnsureConversionsTaskDto {
                conversion_id: row.id.to_string(),
                project_file_id: file_details.id.to_string(),
                input_abs_path: input_abs_path.display().to_string(),
                output_abs_path: output_abs_path.display().to_string(),
                src_lang: src_lang.clone(),
                tgt_lang: tgt_lang.clone(),
                version: version.clone(),
                paragraph: true, // Default to paragraph mode
                embed: true,     // Default to embedded mode
            });
        }
    }

    Ok(EnsureConversionsPlanDto {
        project_id: details.id.to_string(),
        src_lang: project_src_lang,
        tgt_lang: project_tgt_lang,
        version,
        tasks,
        integrity_alerts,
    })
}

/// Helper function to get and validate project root directory
///
/// Centralizes the logic for retrieving and canonicalizing project
/// root paths from the database. Used by other artifact functions.
async fn get_project_root(db: &DbManager, project_id: Uuid) -> Result<PathBuf, IpcError> {
    let details = db
        .list_project_details(project_id)
        .await
        .map_err(IpcError::from)?;
    let root = PathBuf::from(&details.root_path);

    match std::fs::canonicalize(&root) {
        Ok(path) => Ok(path),
        Err(error) => {
            error!(
                target: "ipc::projects::artifacts",
                "failed to canonicalize project root {}: {error}",
                root.display()
            );
            Err(fs_error("resolve project root", error))
        }
    }
}

async fn cached_file_hash(
    cache: &mut HashMap<Uuid, Option<String>>,
    file_id: Uuid,
    root_path: &Path,
    stored_rel_path: &str,
) -> Option<String> {
    if let Some(existing) = cache.get(&file_id) {
        return existing.clone();
    }

    let Some(abs_path) = join_within_project(root_path, stored_rel_path) else {
        warn!(
            target: "ipc::projects::artifacts",
            "unable to compute hash for file {}: stored path '{}' is invalid within project root",
            file_id,
            stored_rel_path
        );
        cache.insert(file_id, None);
        return None;
    };

    match compute_sha256_streaming(&abs_path).await {
        Ok((_bytes, hash)) => {
            let normalized = hash.to_ascii_lowercase();
            cache.insert(file_id, Some(normalized.clone()));
            Some(normalized)
        }
        Err(error) => {
            error!(
                target: "ipc::projects::artifacts",
                "failed to compute hash for file {} at {}: {}",
                file_id,
                abs_path.display(),
                error
            );
            cache.insert(file_id, None);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jliff_conversion_result_serialization() {
        let result = JliffConversionResult {
            file_id: "test-file-id".to_string(),
            jliff_abs_path: "/abs/path/to/file.jliff".to_string(),
            jliff_rel_path: "jliff/file.jliff".to_string(),
            tag_map_abs_path: "/abs/path/to/file.tagmap.json".to_string(),
            tag_map_rel_path: "jliff/file.tagmap.json".to_string(),
        };

        let serialized = serde_json::to_string(&result).unwrap();
        assert!(serialized.contains("fileId"));
        assert!(serialized.contains("jliffAbsPath"));
        assert!(serialized.contains("tagMapRelPath"));
    }

    #[test]
    fn test_update_jliff_segment_result_serialization() {
        let result = UpdateJliffSegmentResult {
            updated_count: 3,
            updated_at: "2023-01-01T12:00:00Z".to_string(),
        };

        let serialized = serde_json::to_string(&result).unwrap();
        assert!(serialized.contains("updatedCount"));
        assert!(serialized.contains("updatedAt"));
    }
}

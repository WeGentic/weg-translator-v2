//! Project artifact management for XLIFF and JLIFF operations
//!
//! This module handles operations on translation artifacts including:
//! - Reading and writing project artifacts
//! - XLIFF to JLIFF conversion coordination
//! - JLIFF document manipulation and updates
//! - Artifact path resolution and security validation

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use log::error;
use serde::Serialize;
use tokio::fs;
use uuid::Uuid;

use super::constants::{DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_XLIFF_VERSION};
use super::utils::resolve_project_relative_path;
use crate::db::DbManager;
use crate::ipc::commands::shared::{fs_error, with_project_file_lock};
use crate::ipc::dto::EnsureConversionsPlanDto;
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

    // Ensure JLIFF output directory exists
    let jliff_dir = DbManager::ensure_subdir(&root_path, "jliff")?;

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
    options.schema_path = schema_path;

    // Perform XLIFF to JLIFF conversion
    let artifacts = convert_xliff(&options).map_err(|error| {
        error!(
            target: "ipc::projects::artifacts",
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

    Ok(JliffConversionResult {
        file_id: conversion.project_file_id.to_string(),
        jliff_abs_path: artifact.jliff_path.to_string_lossy().to_string(),
        jliff_rel_path: jliff_rel.to_string_lossy().to_string(),
        tag_map_abs_path: artifact.tag_map_path.to_string_lossy().to_string(),
        tag_map_rel_path: tag_map_rel.to_string_lossy().to_string(),
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
    let xliff_dir = DbManager::ensure_subdir(&root_path, "xliff")?;

    let mut tasks = Vec::new();

    // Create file lookup map for efficient access
    let file_map = super::dto_mappers::create_file_id_map(&details);

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

        if let Some(file_details) = file_map.get(&row.project_file_id.to_string()) {
            let input_abs_path = root_path.join(&file_details.stored_rel_path);

            // Generate XLIFF filename: <stem>.<src>-<tgt>.xlf
            let stem = Path::new(&file_details.stored_rel_path)
                .file_stem()
                .and_then(std::ffi::OsStr::to_str)
                .unwrap_or("file");
            let target_name = format!("{}.{}-{}.xlf", stem, src_lang, tgt_lang);
            let output_abs_path = xliff_dir.join(target_name);

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

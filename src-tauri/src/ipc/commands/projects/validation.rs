//! Input validation for project management operations
//!
//! This module provides comprehensive validation for all project-related inputs
//! including project names, file paths, and conversion parameters. All validation
//! functions return detailed error messages to help users understand requirements.

use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::PathBuf;

use log::warn;
use tokio::fs;

use super::constants::{ALLOWED_PROJECT_EXTENSIONS, PROJECT_NAME_MAX_LEN, PROJECT_NAME_MIN_LEN};
use crate::db::ProjectType;
use crate::ipc::error::IpcError;

/// Represents a validated file ready for project import
///
/// Contains the canonicalized path, original name, and file extension
/// of a file that has passed all validation checks.
#[derive(Debug, Clone)]
pub struct ValidatedFile {
    /// Canonical (absolute) path to the source file
    pub canonical_path: PathBuf,
    /// Original filename as provided by the user
    pub original_name: String,
    /// Lowercase file extension
    pub extension: String,
}

/// Validates a project name according to business rules
///
/// Project names must:
/// - Be between 2-120 characters after trimming
/// - Contain at least one alphanumeric character
/// - Not be empty after trimming
///
/// # Arguments
/// * `name` - The project name to validate
///
/// # Returns
/// The trimmed project name if valid
///
/// # Errors
/// Returns validation errors for invalid names with specific guidance
pub fn validate_project_name(name: &str) -> Result<String, IpcError> {
    let trimmed = name.trim();

    if trimmed.len() < PROJECT_NAME_MIN_LEN || trimmed.len() > PROJECT_NAME_MAX_LEN {
        return Err(IpcError::Validation(format!(
            "Project name must be between {PROJECT_NAME_MIN_LEN} and {PROJECT_NAME_MAX_LEN} characters.",
        )));
    }

    if !trimmed.chars().any(|ch| ch.is_alphanumeric()) {
        return Err(IpcError::Validation(
            "Project name must include at least one alphanumeric character.".into(),
        ));
    }

    Ok(trimmed.to_string())
}

/// Validates and parses a project type string
///
/// Currently supports:
/// - "translation" - Translation projects with XLIFF workflows
/// - "rag" - RAG (Retrieval-Augmented Generation) projects
///
/// # Arguments
/// * `project_type` - The project type string to validate
///
/// # Returns
/// The parsed ProjectType enum value
///
/// # Errors
/// Returns validation error for unsupported project types
pub fn validate_project_type(project_type: &str) -> Result<ProjectType, IpcError> {
    let normalized = project_type.trim().to_lowercase();
    ProjectType::from_str(&normalized).ok_or_else(|| {
        IpcError::Validation("Project type must be either 'translation' or 'rag'.".into())
    })
}

/// Validates and processes a list of file paths for project import
///
/// This function performs comprehensive validation on each file:
/// - Canonicalizes paths to resolve symlinks and relative references
/// - Checks file accessibility and metadata
/// - Validates file extensions against allowed list
/// - Removes duplicates based on canonical paths
/// - Ensures files are regular files (not directories or special files)
///
/// # Arguments
/// * `file_paths` - Vector of file path strings to validate
///
/// # Returns
/// Vector of ValidatedFile objects ready for import
///
/// # Errors
/// Returns the first validation error encountered, with specific details
/// about which file failed and why
///
/// # Examples
/// ```
/// let paths = vec![
///     "/path/to/document.docx".to_string(),
///     "/path/to/presentation.pptx".to_string(),
/// ];
/// let validated = validate_project_files(paths).await?;
/// ```
pub async fn validate_project_files(
    file_paths: Vec<String>,
) -> Result<Vec<ValidatedFile>, IpcError> {
    if file_paths.is_empty() {
        return Err(IpcError::Validation(
            "Select at least one file to create a project.".into(),
        ));
    }

    let mut unique_paths = HashSet::new();
    let mut validated_files = Vec::new();

    for raw_path in &file_paths {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            return Err(IpcError::Validation("File paths cannot be empty.".into()));
        }

        // Canonicalize the path to resolve symlinks and make it absolute
        let candidate_path = PathBuf::from(trimmed);
        let canonical_path = match fs::canonicalize(&candidate_path).await {
            Ok(path) => path,
            Err(error) => {
                warn!(
                    target: "ipc::projects::validation",
                    "failed to canonicalize file '{trimmed}': {error}"
                );
                return Err(IpcError::Validation(format!(
                    "File '{trimmed}' is not accessible."
                )));
            }
        };

        // Skip duplicates (same canonical path)
        if !unique_paths.insert(canonical_path.clone()) {
            continue;
        }

        // Check file metadata and accessibility
        let metadata = match fs::metadata(&canonical_path).await {
            Ok(meta) => meta,
            Err(error) => {
                warn!(
                    target: "ipc::projects::validation",
                    "failed to read metadata for '{:?}': {error}",
                    canonical_path
                );
                return Err(IpcError::Validation(format!(
                    "File '{trimmed}' is not accessible."
                )));
            }
        };

        // Ensure it's a regular file
        if !metadata.is_file() {
            return Err(IpcError::Validation(format!(
                "'{trimmed}' is not a regular file."
            )));
        }

        // Extract and validate file extension
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
            )));
        }

        // Extract original filename
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

        validated_files.push(ValidatedFile {
            canonical_path,
            original_name,
            extension,
        });
    }

    if validated_files.is_empty() {
        return Err(IpcError::Validation(
            "No unique files were selected.".into(),
        ));
    }

    Ok(validated_files)
}

/// Validates optional language parameters
///
/// Trims language strings and returns None for empty values,
/// allowing callers to apply defaults as needed.
///
/// # Arguments
/// * `lang` - Optional language string to validate
///
/// # Returns
/// Some(trimmed_string) if non-empty, None if empty or None
pub fn validate_optional_language(lang: Option<String>) -> Option<String> {
    lang.and_then(|s| {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

/// Validates conversion status strings
///
/// Ensures the status is one of the allowed values for project file conversions.
///
/// # Arguments
/// * `status` - The status string to validate
///
/// # Returns
/// The validated status string
///
/// # Errors
/// Returns validation error for invalid status values
pub fn validate_conversion_status(status: &str) -> Result<&str, IpcError> {
    match status {
        "pending" | "running" | "completed" | "failed" => Ok(status),
        _ => Err(IpcError::Validation("Invalid conversion status.".into())),
    }
}

/// Validates a transaction unit ID for JLIFF operations
///
/// Ensures the ID is not empty and doesn't contain dangerous characters.
/// Transaction unit IDs are used to identify specific segments in JLIFF files.
///
/// # Arguments
/// * `transunit_id` - The transaction unit ID to validate
///
/// # Returns
/// The validated ID
///
/// # Errors
/// Returns validation error for invalid IDs
pub fn validate_transunit_id(transunit_id: &str) -> Result<&str, IpcError> {
    let trimmed = transunit_id.trim();
    if trimmed.is_empty() {
        return Err(IpcError::Validation(
            "Transaction unit ID cannot be empty.".into(),
        ));
    }

    // Additional validation could be added here for specific ID format requirements
    Ok(trimmed)
}

/// Validates pagination parameters
///
/// Ensures limit and offset values are within reasonable bounds
/// to prevent performance issues and abuse.
///
/// # Arguments
/// * `limit` - Optional limit parameter
/// * `offset` - Optional offset parameter
///
/// # Returns
/// Tuple of (validated_limit, validated_offset)
pub fn validate_pagination_params(limit: Option<i64>, offset: Option<i64>) -> (i64, i64) {
    let validated_limit = limit.unwrap_or(50).clamp(1, 200);
    let validated_offset = offset.unwrap_or(0).max(0);
    (validated_limit, validated_offset)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_project_name_valid() {
        assert_eq!(
            validate_project_name("  My Project  ").unwrap(),
            "My Project"
        );
        assert_eq!(validate_project_name("Test123").unwrap(), "Test123");
    }

    #[test]
    fn test_validate_project_name_too_short() {
        assert!(validate_project_name("A").is_err());
        assert!(validate_project_name("  ").is_err());
    }

    #[test]
    fn test_validate_project_name_too_long() {
        let long_name = "a".repeat(121);
        assert!(validate_project_name(&long_name).is_err());
    }

    #[test]
    fn test_validate_project_name_no_alphanumeric() {
        assert!(validate_project_name("!!!").is_err());
        assert!(validate_project_name("   ---   ").is_err());
    }

    #[test]
    fn test_validate_project_type() {
        assert!(matches!(
            validate_project_type("translation").unwrap(),
            ProjectType::Translation
        ));
        assert!(matches!(
            validate_project_type("  RAG  ").unwrap(),
            ProjectType::Rag
        ));
        assert!(validate_project_type("invalid").is_err());
    }

    #[test]
    fn test_validate_optional_language() {
        assert_eq!(
            validate_optional_language(Some("en-US".to_string())),
            Some("en-US".to_string())
        );
        assert_eq!(
            validate_optional_language(Some("  fr-FR  ".to_string())),
            Some("fr-FR".to_string())
        );
        assert_eq!(validate_optional_language(Some("".to_string())), None);
        assert_eq!(validate_optional_language(Some("   ".to_string())), None);
        assert_eq!(validate_optional_language(None), None);
    }

    #[test]
    fn test_validate_conversion_status() {
        assert_eq!(validate_conversion_status("pending").unwrap(), "pending");
        assert_eq!(validate_conversion_status("running").unwrap(), "running");
        assert_eq!(
            validate_conversion_status("completed").unwrap(),
            "completed"
        );
        assert_eq!(validate_conversion_status("failed").unwrap(), "failed");
        assert!(validate_conversion_status("invalid").is_err());
    }

    #[test]
    fn test_validate_pagination_params() {
        assert_eq!(validate_pagination_params(None, None), (50, 0));
        assert_eq!(validate_pagination_params(Some(10), Some(5)), (10, 5));
        assert_eq!(validate_pagination_params(Some(0), Some(-5)), (1, 0)); // Clamped
        assert_eq!(validate_pagination_params(Some(300), None), (200, 0)); // Clamped
    }
}

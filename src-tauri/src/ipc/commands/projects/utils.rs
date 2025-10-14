//! Utility functions for project management
//!
//! This module contains helper functions for common operations like:
//! - String manipulation and slug generation
//! - Path validation and security checks
//! - Cleanup helpers for artifact removal

use std::ffi::OsStr;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use log::warn;
use tokio::fs;
use uuid::Uuid;

use super::constants::{
    DEFAULT_FILE_STEM, DEFAULT_PROJECT_SLUG, PROJECT_DIR_ORIGINAL, PROJECT_DIR_STAGING_ORIGINAL,
};
use crate::ipc::error::IpcError;

/// Converts a project name into a URL-safe slug
///
/// This function:
/// - Converts to lowercase
/// - Replaces non-alphanumeric characters with hyphens
/// - Removes consecutive hyphens
/// - Trims leading/trailing hyphens
/// - Returns default slug if result is empty
///
/// # Arguments
/// * `name` - The project name to slugify
///
/// # Examples
/// ```
/// assert_eq!(slugify("  Marketing Launch  "), "marketing-launch");
/// assert_eq!(slugify("项目"), "project"); // fallback for non-ASCII
/// ```
pub fn slugify(name: &str) -> String {
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
        DEFAULT_PROJECT_SLUG.into()
    } else {
        trimmed
    }
}

fn sanitized_file_stem(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .and_then(OsStr::to_str)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(DEFAULT_FILE_STEM);
    let slug = slugify(stem);
    if slug == DEFAULT_PROJECT_SLUG {
        DEFAULT_FILE_STEM.into()
    } else {
        slug
    }
}

/// Builds the relative storage path for an original uploaded file.
///
/// The stored path follows the convention:
/// `original/<file_id>__<slugified-name>[.<ext>]`
pub fn build_original_stored_rel_path(file_id: Uuid, original_name: &str) -> String {
    let mut file_name = format!("{}__{}", file_id, sanitized_file_stem(original_name));
    if let Some(ext) = Path::new(original_name)
        .extension()
        .and_then(OsStr::to_str)
        .filter(|ext| !ext.trim().is_empty())
    {
        file_name.push('.');
        file_name.push_str(&ext.to_ascii_lowercase());
    }

    Path::new(PROJECT_DIR_ORIGINAL)
        .join(file_name)
        .to_string_lossy()
        .to_string()
}

#[allow(dead_code)]
pub fn build_staging_original_stored_rel_path(file_id: Uuid, original_name: &str) -> String {
    let mut file_name = format!("{}__{}", file_id, sanitized_file_stem(original_name));
    if let Some(ext) = Path::new(original_name)
        .extension()
        .and_then(OsStr::to_str)
        .filter(|ext| !ext.trim().is_empty())
    {
        file_name.push('.');
        file_name.push_str(&ext.to_ascii_lowercase());
    }

    Path::new(PROJECT_DIR_STAGING_ORIGINAL)
        .join(file_name)
        .to_string_lossy()
        .to_string()
}

/// Builds a unique project slug combining name and UUID
///
/// Creates a slug by combining the slugified project name with
/// the first 8 characters of the project UUID to ensure uniqueness.
///
/// # Arguments
/// * `name` - The project name
/// * `project_id` - The project UUID for uniqueness
///
/// # Returns
/// A unique slug in the format "slugified-name-uuid8chars"
///
/// # Examples
/// ```
/// let id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();
/// assert_eq!(
///     build_project_slug("Marketing Launch", id),
///     "marketing-launch-12345678"
/// );
/// ```
pub fn build_project_slug(name: &str, project_id: Uuid) -> String {
    let base = slugify(name);
    let mut unique = project_id.simple().to_string();
    unique.truncate(8);
    format!("{base}-{unique}")
}

/// Validates a relative artifact path to ensure it stays within the project root
///
/// This function performs security validation to prevent path traversal attacks
/// by checking that the relative path:
/// - Is not empty
/// - Is not absolute
/// - Contains no parent directory references (..)
/// - Contains no root directory references
/// - Contains no drive prefixes (Windows)
/// - Resolves to a path within the project root
///
/// # Arguments
/// * `root` - The project root directory (must be absolute)
/// * `rel_path` - The relative path to validate
/// * `action` - Description of the action for error messages
///
/// # Returns
/// The canonical absolute path if validation succeeds
///
/// # Errors
/// Returns `IpcError::Validation` for invalid paths or `IpcError::Internal` for filesystem errors
///
/// # Security
/// This function is critical for preventing directory traversal attacks.
/// It ensures that user-provided relative paths cannot escape the project directory.
pub fn resolve_project_relative_path(
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

    // Check for dangerous path components
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
            // Double-check that the canonical path is still within the root
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
            log::error!(
                target: "ipc::projects::utils",
                "failed to canonicalize artifact path {}: {error}",
                candidate.display()
            );
            Err(crate::ipc::commands::shared::fs_error(action, error))
        }
    }
}

/// Safely joins a relative path within a project directory
///
/// This is a lighter-weight version of `resolve_project_relative_path`
/// that doesn't require the target file to exist. Used for cleanup operations
/// where the file may have already been removed.
///
/// # Arguments
/// * `root_path` - The project root directory
/// * `rel_path` - The relative path to join
///
/// # Returns
/// Some(PathBuf) if the path is safe, None if it's potentially dangerous
///
/// # Security
/// Validates against directory traversal but doesn't require file existence
pub fn join_within_project(root_path: &Path, rel_path: &str) -> Option<PathBuf> {
    let rel = Path::new(rel_path.trim());
    if rel.as_os_str().is_empty() || rel.is_absolute() {
        return None;
    }

    // Check for dangerous path components
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

/// Sanitizes an input string so it can be safely used as a filesystem
/// directory segment for artifacts. Only ASCII alphanumeric characters
/// and hyphens are preserved; other characters collapse into single
/// hyphens. Empty or whitespace-only inputs fall back to "unknown".
pub fn sanitize_artifact_segment(value: &str) -> String {
    let mut sanitized = String::new();
    let mut last_was_dash = false;

    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            sanitized.push(ch);
            last_was_dash = false;
        } else if ch == '-' {
            if !last_was_dash {
                sanitized.push('-');
                last_was_dash = true;
            }
        } else if !last_was_dash {
            sanitized.push('-');
            last_was_dash = true;
        }
    }

    let trimmed = sanitized.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "unknown".into()
    } else {
        trimmed
    }
}

/// Builds the subdirectory name used for language-specific artifacts
/// by sanitizing both the source and target language codes.
pub fn build_language_directory_name(src_lang: &str, tgt_lang: &str) -> String {
    format!(
        "{}__{}",
        sanitize_artifact_segment(src_lang),
        sanitize_artifact_segment(tgt_lang)
    )
}

/// Removes a file and attempts to clean up empty parent directories
///
/// This function removes a file and then walks up the directory tree,
/// removing empty directories up to (but not including) the project root.
/// This keeps the project directory clean after file removal.
///
/// # Arguments
/// * `path` - The file path to remove
/// * `root_path` - The project root (won't be removed)
/// * `label` - Description for logging purposes
pub async fn remove_file_and_cleanup(path: &Path, root_path: &Path, label: &str) {
    match fs::remove_file(path).await {
        Ok(()) => cleanup_empty_parents(path.parent(), root_path).await,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            // File already gone, nothing to do
        }
        Err(error) => {
            warn!(
                target: "ipc::projects::utils",
                "failed to remove {} {:?}: {}",
                label,
                path,
                error
            );
        }
    }
}

/// Recursively removes empty parent directories up to the project root
///
/// Walks up the directory tree from the given starting point, removing
/// empty directories until it reaches the project root or encounters
/// a non-empty directory.
///
/// # Arguments
/// * `current` - Starting directory (typically parent of removed file)
/// * `root_path` - Project root directory (stopping point)
async fn cleanup_empty_parents(mut current: Option<&Path>, root_path: &Path) {
    while let Some(dir) = current {
        // Don't remove the project root or anything outside it
        if dir == root_path || !dir.starts_with(root_path) {
            break;
        }

        match fs::remove_dir(dir).await {
            Ok(()) => {
                // Directory removed successfully, try parent
                current = dir.parent();
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                // Directory already gone, try parent
                current = dir.parent();
            }
            Err(error) if error.kind() == ErrorKind::DirectoryNotEmpty => {
                // Directory not empty, stop cleanup
                break;
            }
            Err(error) => {
                warn!(
                    target: "ipc::projects::utils",
                    "failed to cleanup directory {:?}: {}",
                    dir,
                    error
                );
                break;
            }
        }
    }
}

/// Removes a project artifact by relative path with safety checks
///
/// Safely removes a file specified by relative path, performing
/// path validation and cleanup of empty parent directories.
///
/// # Arguments
/// * `root_path` - The project root directory
/// * `rel_path` - The relative path of the artifact to remove
/// * `label` - Description for logging purposes
pub async fn remove_relative_artifact(root_path: &Path, rel_path: &str, label: &str) {
    if rel_path.trim().is_empty() {
        return;
    }

    let Some(full_path) = join_within_project(root_path, rel_path) else {
        warn!(
            target: "ipc::projects::utils",
            "skipping cleanup for {} with unsafe path '{}'",
            label,
            rel_path
        );
        return;
    };

    remove_file_and_cleanup(&full_path, root_path, label).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify_normalizes_and_trims() {
        assert_eq!(slugify("  Marketing Launch  "), "marketing-launch");
    }

    #[test]
    fn test_slugify_falls_back_when_no_ascii_characters() {
        assert_eq!(slugify("项目"), "project");
    }

    #[test]
    fn test_build_project_slug_appends_unique_suffix() {
        let id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();
        assert_eq!(
            build_project_slug("Marketing Launch", id),
            "marketing-launch-12345678"
        );
    }

    #[test]
    fn test_join_within_project_rejects_dangerous_paths() {
        let root = Path::new("/project/root");

        // Valid relative paths
        assert!(join_within_project(root, "file.txt").is_some());
        assert!(join_within_project(root, "subdir/file.txt").is_some());

        // Dangerous paths should be rejected
        assert!(join_within_project(root, "../outside.txt").is_none());
        assert!(join_within_project(root, "/absolute/path.txt").is_none());
        assert!(join_within_project(root, "").is_none());
        assert!(join_within_project(root, "  ").is_none());
    }

    #[test]
    fn test_sanitize_artifact_segment_normalizes_values() {
        assert_eq!(sanitize_artifact_segment("en-US"), "en-US");
        assert_eq!(sanitize_artifact_segment("../../etc/passwd"), "etc-passwd");
        assert_eq!(sanitize_artifact_segment("  "), "unknown");
    }

    #[test]
    fn test_build_language_directory_name_sanitizes_components() {
        let dir = build_language_directory_name("en-US", "fr-FR");
        assert_eq!(dir, "en-US__fr-FR");

        let malicious = build_language_directory_name("../../en", "fr/../..");
        assert_eq!(malicious, "en__fr");
    }
}

//! File system operations for project management
//!
//! This module handles all file system operations including:
//! - Project directory creation and management
//! - File copying and importing
//! - Directory cleanup and maintenance
//! - File metadata collection

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use log::{error, warn};
use tokio::fs;
use uuid::Uuid;

use super::constants::PROJECTS_DIR_NAME;
use super::utils::{build_project_slug, next_available_file_name};
use super::validation::ValidatedFile;
use crate::db::{NewProjectFile, ProjectFileImportStatus};
use crate::ipc::error::IpcError;
use crate::settings::SettingsManager;

/// Result of project directory creation
///
/// Contains the created directory path and metadata about the operation
#[derive(Debug)]
pub struct CreatedProjectDirectory {
    /// Absolute path to the created project directory
    pub project_dir: PathBuf,
    /// Generated folder name (includes UUID for uniqueness)
    pub folder_name: String,
}

/// Result of file import operations
///
/// Contains metadata about successfully imported files
#[derive(Debug)]
pub struct ImportedFile {
    /// Database record ready for insertion
    pub db_record: NewProjectFile,
    /// Path where the file was stored
    pub stored_path: PathBuf,
}

/// Creates a new project directory structure
///
/// This function:
/// 1. Ensures the projects directory exists
/// 2. Creates a unique project subdirectory
/// 3. Uses project name and UUID for uniqueness
/// 4. Sets up proper permissions
///
/// # Arguments
/// * `settings` - Settings manager for app folder location
/// * `project_name` - Name of the project for directory naming
/// * `project_id` - UUID for uniqueness
///
/// # Returns
/// Information about the created directory
///
/// # Errors
/// Returns errors if directory creation fails or permissions are insufficient
///
/// # Directory Structure
/// ```
/// app_folder/
/// └── projects/
///     └── {uuid}-{slug}/     # Created by this function
/// ```
pub async fn create_project_directory(
    settings: &SettingsManager,
    project_name: &str,
    project_id: Uuid,
) -> Result<CreatedProjectDirectory, IpcError> {
    let app_folder = settings.app_folder().await;
    let projects_dir = app_folder.join(PROJECTS_DIR_NAME);

    // Ensure the projects directory exists
    if let Err(error) = fs::create_dir_all(&projects_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to prepare projects directory {:?}: {error}",
            projects_dir
        );
        return Err(IpcError::Internal(
            "Unable to prepare projects storage directory.".into(),
        ));
    }

    // Create unique project directory
    let slug = build_project_slug(project_name, project_id);
    let folder_name = format!("{}-{}", project_id, slug);
    let project_dir = projects_dir.join(&folder_name);

    if let Err(error) = fs::create_dir_all(&project_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to create project directory {:?}: {error}",
            project_dir
        );
        return Err(IpcError::Internal(
            "Unable to create project directory.".into(),
        ));
    }

    Ok(CreatedProjectDirectory {
        project_dir,
        folder_name,
    })
}

/// Imports validated files into a project directory
///
/// This function:
/// 1. Generates unique filenames to avoid collisions
/// 2. Copies files to the project directory
/// 3. Collects file metadata (size, checksums)
/// 4. Creates database records for each file
/// 5. Handles cleanup on failure
///
/// # Arguments
/// * `project_dir` - Target project directory
/// * `project_id` - Project UUID for database records
/// * `validated_files` - Pre-validated files ready for import
///
/// # Returns
/// Vector of imported file metadata and database records
///
/// # Errors
/// Returns errors if file operations fail. On error, attempts partial cleanup.
///
/// # Transaction Safety
/// This function doesn't provide full transaction safety - if it fails partway
/// through, some files may have been copied. Callers should handle cleanup
/// of the project directory on error.
pub async fn import_files_to_project(
    project_dir: &Path,
    project_id: Uuid,
    validated_files: &[ValidatedFile],
) -> Result<Vec<ImportedFile>, IpcError> {
    let mut imported_files = Vec::with_capacity(validated_files.len());

    for validated_file in validated_files {
        // Find a unique filename in the project directory
        let stored_filename =
            match next_available_file_name(project_dir, &validated_file.original_name).await {
                Ok(name) => name,
                Err(error) => {
                    error!(
                        target: "ipc::projects::file_operations",
                        "failed to resolve unique filename for {:?}: {error}",
                        validated_file.original_name
                    );
                    return Err(IpcError::Internal(
                        "Unable to stage imported files for the project.".into(),
                    ));
                }
            };

        let destination_path = project_dir.join(&stored_filename);

        // Copy the file
        if let Err(error) = fs::copy(&validated_file.canonical_path, &destination_path).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to copy file {:?} -> {:?}: {error}",
                validated_file.canonical_path,
                destination_path
            );
            return Err(IpcError::Internal(
                "Unable to copy selected files into the project.".into(),
            ));
        }

        // Collect file metadata
        let size_bytes = match fs::metadata(&destination_path).await {
            Ok(meta) => i64::try_from(meta.len()).ok(),
            Err(error) => {
                warn!(
                    target: "ipc::projects::file_operations",
                    "failed to inspect copied file {:?}: {error}",
                    destination_path
                );
                None
            }
        };

        // Create database record
        let db_record = NewProjectFile {
            id: Uuid::new_v4(),
            project_id,
            original_name: validated_file.original_name.clone(),
            original_path: validated_file.canonical_path.display().to_string(),
            stored_rel_path: stored_filename.clone(),
            ext: validated_file.extension.clone(),
            size_bytes,
            checksum_sha256: None, // TODO: Could be calculated here if needed
            import_status: ProjectFileImportStatus::Imported,
        };

        imported_files.push(ImportedFile {
            db_record,
            stored_path: destination_path,
        });
    }

    Ok(imported_files)
}

/// Completely removes a project directory and all its contents
///
/// This function attempts to remove the entire project directory tree.
/// It tolerates missing directories to support cases where users have
/// manually cleaned up or moved project files.
///
/// # Arguments
/// * `project_dir` - Path to the project directory to remove
///
/// # Errors
/// Logs warnings for removal failures but doesn't return errors,
/// allowing the database cleanup to proceed even if filesystem
/// cleanup fails.
pub async fn cleanup_project_directory(project_dir: &Path) {
    match fs::remove_dir_all(project_dir).await {
        Ok(_) => {
            // Successfully removed
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {
            // Directory already gone, nothing to do
        }
        Err(error) => {
            warn!(
                target: "ipc::projects::file_operations",
                "failed to cleanup project directory {:?}: {error}",
                project_dir
            );
        }
    }
}

/// Removes multiple project artifacts by their relative paths
///
/// Safely removes a collection of project files and artifacts,
/// cleaning up empty directories afterward. Used during project
/// file removal to clean up associated conversion artifacts.
///
/// # Arguments
/// * `root_path` - Project root directory
/// * `relative_paths` - Iterator of relative paths to remove
/// * `label` - Description for logging purposes
pub async fn remove_multiple_artifacts<'a, I>(root_path: &Path, relative_paths: I, label: &str)
where
    I: Iterator<Item = &'a str>,
{
    use super::utils::remove_relative_artifact;

    for rel_path in relative_paths {
        remove_relative_artifact(root_path, rel_path, label).await;
    }
}

/// Ensures a subdirectory exists within a project
///
/// Creates the specified subdirectory if it doesn't exist.
/// This is used to organize project artifacts (e.g., "xliff", "jliff" directories).
///
/// # Arguments
/// * `project_root` - The project root directory
/// * `subdir_name` - Name of the subdirectory to create
///
/// # Returns
/// Path to the created/existing subdirectory
///
/// # Errors
/// Returns IpcError if directory creation fails
pub async fn ensure_project_subdirectory(
    project_root: &Path,
    subdir_name: &str,
) -> Result<PathBuf, IpcError> {
    let subdir_path = project_root.join(subdir_name);

    if let Err(error) = fs::create_dir_all(&subdir_path).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to create subdirectory {:?}: {error}",
            subdir_path
        );
        return Err(IpcError::Internal(format!(
            "Unable to create {} directory in project.",
            subdir_name
        )));
    }

    Ok(subdir_path)
}

/// Checks if a directory exists and is accessible
///
/// Safe wrapper around directory existence checks that handles
/// permission errors gracefully.
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// true if the directory exists and is accessible, false otherwise
pub async fn directory_exists(path: &Path) -> bool {
    match fs::metadata(path).await {
        Ok(metadata) => metadata.is_dir(),
        Err(_) => false,
    }
}

/// Checks if a file exists and is accessible
///
/// Safe wrapper around file existence checks that handles
/// permission errors gracefully.
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// true if the file exists and is accessible, false otherwise
pub async fn file_exists(path: &Path) -> bool {
    match fs::metadata(path).await {
        Ok(metadata) => metadata.is_file(),
        Err(_) => false,
    }
}

/// Gets the size of a file in bytes
///
/// Returns the file size or None if the file is inaccessible.
/// Used for collecting metadata during file operations.
///
/// # Arguments
/// * `path` - Path to the file
///
/// # Returns
/// File size in bytes, or None if inaccessible
pub async fn get_file_size(path: &Path) -> Option<u64> {
    match fs::metadata(path).await {
        Ok(metadata) if metadata.is_file() => Some(metadata.len()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_directory_exists() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        assert!(directory_exists(dir_path).await);
        assert!(!directory_exists(&dir_path.join("nonexistent")).await);
    }

    #[tokio::test]
    async fn test_file_exists() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        // File doesn't exist yet
        assert!(!file_exists(&file_path).await);

        // Create file
        fs::write(&file_path, "test content").await.unwrap();
        assert!(file_exists(&file_path).await);

        // Directory should not be considered a file
        assert!(!file_exists(temp_dir.path()).await);
    }

    #[tokio::test]
    async fn test_get_file_size() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let content = "Hello, World!";

        // File doesn't exist
        assert_eq!(get_file_size(&file_path).await, None);

        // Create file with known content
        fs::write(&file_path, content).await.unwrap();
        assert_eq!(get_file_size(&file_path).await, Some(content.len() as u64));

        // Directory should return None
        assert_eq!(get_file_size(temp_dir.path()).await, None);
    }
}

//! File system operations for project management
//!
//! This module handles all file system operations including:
//! - Project directory creation and management
//! - File copying and importing
//! - Directory cleanup and maintenance
//! - File metadata collection

use std::convert::TryFrom;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use log::{error, warn};
use sha2::{Digest, Sha256};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use super::constants::{
    PROJECT_DIR_ARTIFACTS, PROJECT_DIR_ARTIFACTS_QA, PROJECT_DIR_ARTIFACTS_XJLIFF,
    PROJECT_DIR_ARTIFACTS_XLIFF, PROJECT_DIR_ORIGINAL, PROJECT_DIR_STAGING,
    PROJECT_DIR_STAGING_ORIGINAL, PROJECTS_DIR_NAME,
};
use super::utils::{build_original_stored_rel_path, build_project_slug};
use super::validation::ValidatedFile;
use crate::db::{
    NewProjectFile, ProjectFileImportStatus, ProjectFileRole, ProjectFileStorageState,
};
use crate::ipc::error::IpcError;
use crate::settings::SettingsManager;

/// Buffer size used for streaming file copy/hash operations (16 KiB).
const FILE_COPY_BUFFER_SIZE: usize = 16 * 1024;

/// Result of project directory creation
///
/// Contains the created directory path and metadata about the operation
#[allow(dead_code)]
#[derive(Debug)]
pub struct CreatedProjectDirectory {
    /// Absolute path to the created project directory
    pub project_dir: PathBuf,
    /// Generated folder name (includes UUID for uniqueness)
    pub folder_name: String,
}

/// Result of staging directory creation
///
/// Provides staging and final directory paths so callers can promote
/// the project atomically once the staged copy succeeds.
#[derive(Debug)]
pub struct CreatedProjectStagingDirectory {
    /// Absolute path to the staging directory (includes `.staging` suffix)
    pub staging_dir: PathBuf,
    /// Final directory path (sibling of staging, without `.staging`)
    pub final_dir: PathBuf,
}

/// Result metadata produced after copying a file into the staging directory.
#[derive(Debug, Clone)]
pub struct StagedFileMetadata {
    /// Size of the copied file in bytes
    pub size_bytes: i64,
    /// SHA-256 hash of the copied file (hex encoded)
    pub hash_sha256: String,
}

/// Result of file import operations
///
/// Contains metadata about successfully imported files
#[derive(Debug)]
pub struct ImportedFile {
    /// Database record ready for insertion
    pub db_record: NewProjectFile,
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
#[allow(dead_code)]
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

    ensure_project_subdirectory(&project_dir, PROJECT_DIR_ORIGINAL).await?;
    let artifacts_dir = ensure_project_subdirectory(&project_dir, PROJECT_DIR_ARTIFACTS).await?;
    ensure_project_subdirectory(&artifacts_dir, PROJECT_DIR_ARTIFACTS_XLIFF).await?;
    ensure_project_subdirectory(&artifacts_dir, PROJECT_DIR_ARTIFACTS_XJLIFF).await?;
    ensure_project_subdirectory(&artifacts_dir, PROJECT_DIR_ARTIFACTS_QA).await?;

    Ok(CreatedProjectDirectory {
        project_dir,
        folder_name,
    })
}

/// Creates the staging directory structure for a project import
///
/// This prepares a sibling directory alongside the eventual project folder:
/// `{uuid}-{slug}.staging`. Inside this directory we mirror the final layout
/// under `.staging/` so files can be copied safely before promoting the folder.
///
/// # Arguments
/// * `settings` - Settings manager for app folder access
/// * `project_name` - Project name, used for slug generation
/// * `project_id` - Project UUID
pub async fn create_project_staging_dir(
    settings: &SettingsManager,
    project_name: &str,
    project_id: Uuid,
) -> Result<CreatedProjectStagingDirectory, IpcError> {
    let app_folder = settings.app_folder().await;
    let projects_dir = app_folder.join(PROJECTS_DIR_NAME);

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

    let slug = build_project_slug(project_name, project_id);
    let final_folder_name = format!("{}-{}", project_id, slug);
    let staging_folder_name = format!("{final_folder_name}.staging");

    let final_dir = projects_dir.join(&final_folder_name);
    let staging_dir = projects_dir.join(&staging_folder_name);

    match fs::metadata(&staging_dir).await {
        Ok(metadata) if metadata.is_dir() => {
            // Clean out any leftover staging directory from previous attempts.
            if let Err(error) = fs::remove_dir_all(&staging_dir).await {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed to remove existing staging directory {:?}: {error}",
                    staging_dir
                );
                return Err(IpcError::Internal(
                    "Unable to reset project staging directory.".into(),
                ));
            }
        }
        Ok(_) => {
            // A non-directory entry exists at the staging path.
            if let Err(error) = fs::remove_file(&staging_dir).await {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed to remove conflicting staging entry {:?}: {error}",
                    staging_dir
                );
                return Err(IpcError::Internal(
                    "Unable to reset project staging directory.".into(),
                ));
            }
        }
        Err(err) if err.kind() == ErrorKind::NotFound => {
            // No previous staging directory, nothing to clean up.
        }
        Err(err) => {
            error!(
                target: "ipc::projects::file_operations",
                "failed to inspect staging directory {:?}: {err}",
                staging_dir
            );
            return Err(IpcError::Internal(
                "Unable to prepare project staging directory.".into(),
            ));
        }
    }

    if let Err(error) = fs::create_dir_all(&staging_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to create staging directory {:?}: {error}",
            staging_dir
        );
        return Err(IpcError::Internal(
            "Unable to create project staging directory.".into(),
        ));
    }

    // Mirror the final directory structure within `.staging/`.
    let staging_subdirs = [
        PathBuf::from(PROJECT_DIR_STAGING),
        PathBuf::from(PROJECT_DIR_STAGING_ORIGINAL),
        PathBuf::from(PROJECT_DIR_STAGING).join(PROJECT_DIR_ARTIFACTS),
        PathBuf::from(PROJECT_DIR_STAGING)
            .join(PROJECT_DIR_ARTIFACTS)
            .join(PROJECT_DIR_ARTIFACTS_XLIFF),
        PathBuf::from(PROJECT_DIR_STAGING)
            .join(PROJECT_DIR_ARTIFACTS)
            .join(PROJECT_DIR_ARTIFACTS_XJLIFF),
        PathBuf::from(PROJECT_DIR_STAGING)
            .join(PROJECT_DIR_ARTIFACTS)
            .join(PROJECT_DIR_ARTIFACTS_QA),
    ];

    for rel_path in staging_subdirs {
        let dir_path = staging_dir.join(&rel_path);
        if let Err(error) = fs::create_dir_all(&dir_path).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to create staging subdirectory {:?}: {error}",
                dir_path
            );
            return Err(IpcError::Internal(
                "Unable to prepare project staging subdirectories.".into(),
            ));
        }
    }

    Ok(CreatedProjectStagingDirectory {
        staging_dir,
        final_dir,
    })
}

/// Computes a streaming SHA-256 hash for the provided file path.
///
/// The hash is computed using a 16 KiB buffer to balance throughput and memory
/// footprint. The function returns both the total bytes read and the resulting
/// hex-encoded hash so callers can persist metadata without rereading the file.
pub async fn compute_sha256_streaming(path: &Path) -> Result<(i64, String), IpcError> {
    let mut file = match fs::File::open(path).await {
        Ok(file) => file,
        Err(error) => {
            error!(
                target: "ipc::projects::file_operations",
                "failed to open file {:?} for hashing: {error}",
                path
            );
            return Err(IpcError::Internal(
                "Unable to read project file for hashing.".into(),
            ));
        }
    };

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; FILE_COPY_BUFFER_SIZE];
    let mut total_bytes: i64 = 0;

    loop {
        let read = match file.read(&mut buffer).await {
            Ok(bytes) => bytes,
            Err(error) => {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed while hashing file {:?}: {error}",
                    path
                );
                return Err(IpcError::Internal(
                    "Unable to compute checksum for project file.".into(),
                ));
            }
        };

        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
        total_bytes += read as i64;
    }

    let hash = hasher.finalize();
    Ok((total_bytes, format!("{hash:x}")))
}

/// Copies a source file into the staging directory while streaming a SHA-256 hash.
///
/// # Arguments
/// * `source_path` - Canonical path to the source file selected by the user.
/// * `staging_root` - Root directory returned by [`create_project_staging_dir`].
/// * `staged_rel_path` - Relative path (within `staging_root`) where the file should land.
pub async fn copy_file_into_staging(
    source_path: &Path,
    staging_root: &Path,
    staged_rel_path: &str,
) -> Result<StagedFileMetadata, IpcError> {
    let destination_path = staging_root.join(Path::new(staged_rel_path));

    if let Some(parent) = destination_path.parent() {
        if let Err(error) = fs::create_dir_all(parent).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to prepare staging parent directory {:?}: {error}",
                parent
            );
            return Err(IpcError::Internal(
                "Unable to prepare staging directory for project files.".into(),
            ));
        }
    }

    let mut source_file = match fs::File::open(source_path).await {
        Ok(file) => file,
        Err(error) => {
            error!(
                target: "ipc::projects::file_operations",
                "failed to open source file {:?} for staging: {error}",
                source_path
            );
            return Err(IpcError::Internal(
                "Unable to read selected project file.".into(),
            ));
        }
    };

    let mut destination_file = match fs::File::create(&destination_path).await {
        Ok(file) => file,
        Err(error) => {
            error!(
                target: "ipc::projects::file_operations",
                "failed to create staged file {:?}: {error}",
                destination_path
            );
            return Err(IpcError::Internal(
                "Unable to stage project file for import.".into(),
            ));
        }
    };

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; FILE_COPY_BUFFER_SIZE];
    let mut total_bytes: i64 = 0;

    loop {
        let read = match source_file.read(&mut buffer).await {
            Ok(bytes) => bytes,
            Err(error) => {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed while reading source file {:?}: {error}",
                    source_path
                );
                let _ = fs::remove_file(&destination_path).await;
                return Err(IpcError::Internal(
                    "Unable to read selected project file.".into(),
                ));
            }
        };

        if read == 0 {
            break;
        }

        if let Err(error) = destination_file.write_all(&buffer[..read]).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed while writing staged file {:?}: {error}",
                destination_path
            );
            let _ = fs::remove_file(&destination_path).await;
            return Err(IpcError::Internal(
                "Unable to copy project file into staging.".into(),
            ));
        }

        hasher.update(&buffer[..read]);
        total_bytes += read as i64;
    }

    if let Err(error) = destination_file.flush().await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to flush staged file {:?}: {error}",
            destination_path
        );
        let _ = fs::remove_file(&destination_path).await;
        return Err(IpcError::Internal(
            "Unable to finalize staged project file.".into(),
        ));
    }

    if let Err(error) = destination_file.sync_all().await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to sync staged file {:?}: {error}",
            destination_path
        );
        let _ = fs::remove_file(&destination_path).await;
        return Err(IpcError::Internal(
            "Unable to finalize staged project file.".into(),
        ));
    }

    let hash = hasher.finalize();
    Ok(StagedFileMetadata {
        size_bytes: total_bytes,
        hash_sha256: format!("{hash:x}"),
    })
}

/// Promotes a staged project directory to the final layout.
///
/// Performs the following operations:
/// 1. Ensures the final directory does not already exist.
/// 2. Atomically renames `{uuid}-{slug}.staging` → `{uuid}-{slug}`.
/// 3. Renames nested `.staging/original` and `.staging/artifacts` directories to their final locations.
/// 4. Removes the now-empty `.staging` placeholder directory.
pub async fn promote_staging_directory(
    staging: &CreatedProjectStagingDirectory,
) -> Result<(), IpcError> {
    if directory_exists(&staging.final_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "final project directory already exists {:?}",
            staging.final_dir
        );
        return Err(IpcError::Internal(
            "Project directory already exists; cannot promote staging area.".into(),
        ));
    }

    if let Err(error) = fs::rename(&staging.staging_dir, &staging.final_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to promote staging directory {:?} -> {:?}: {error}",
            staging.staging_dir, staging.final_dir
        );
        return Err(IpcError::Internal(
            "Unable to promote staged project directory.".into(),
        ));
    }

    let nested_staging = staging.final_dir.join(PROJECT_DIR_STAGING);
    let mut original_promoted = false;
    let mut artifacts_promoted = false;

    let nested_exists = fs::metadata(&nested_staging).await.is_ok();
    if nested_exists {
        let staged_original = nested_staging.join(PROJECT_DIR_ORIGINAL);
        let final_original = staging.final_dir.join(PROJECT_DIR_ORIGINAL);
        if fs::metadata(&staged_original).await.is_ok() {
            if let Err(error) = fs::rename(&staged_original, &final_original).await {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed to promote staged originals {:?} -> {:?}: {error}",
                    staged_original, final_original
                );
                let _ = fs::rename(&staging.final_dir, &staging.staging_dir).await;
                return Err(IpcError::Internal(
                    "Unable to promote staged project directory.".into(),
                ));
            }
            original_promoted = true;
        }

        let staged_artifacts = nested_staging.join(PROJECT_DIR_ARTIFACTS);
        let final_artifacts = staging.final_dir.join(PROJECT_DIR_ARTIFACTS);
        if fs::metadata(&staged_artifacts).await.is_ok() {
            if let Err(error) = fs::rename(&staged_artifacts, &final_artifacts).await {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed to promote staged artifacts {:?} -> {:?}: {error}",
                    staged_artifacts, final_artifacts
                );
                if original_promoted {
                    let _ = fs::rename(&final_original, &staged_original).await;
                }
                let _ = fs::rename(&staging.final_dir, &staging.staging_dir).await;
                return Err(IpcError::Internal(
                    "Unable to promote staged project directory.".into(),
                ));
            }
            artifacts_promoted = true;
        }

        if let Err(error) = fs::remove_dir(&nested_staging).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to remove emptied staging placeholder {:?}: {error}",
                nested_staging
            );
            if artifacts_promoted {
                let staged_artifacts = nested_staging.join(PROJECT_DIR_ARTIFACTS);
                let _ = fs::rename(&final_artifacts, &staged_artifacts).await;
            }
            if original_promoted {
                let staged_original = nested_staging.join(PROJECT_DIR_ORIGINAL);
                let _ = fs::rename(&final_original, &staged_original).await;
            }
            let _ = fs::rename(&staging.final_dir, &staging.staging_dir).await;
            return Err(IpcError::Internal(
                "Unable to finalise project staging directory.".into(),
            ));
        }
    }

    Ok(())
}

/// Attempts to revert a previously promoted staging directory back to its staged form.
pub async fn revert_promoted_directory(
    staging: &CreatedProjectStagingDirectory,
) -> Result<(), IpcError> {
    if fs::metadata(&staging.final_dir).await.is_err() {
        return Ok(());
    }

    let nested_staging = staging.final_dir.join(PROJECT_DIR_STAGING);
    if fs::metadata(&nested_staging).await.is_err() {
        if let Err(error) = fs::create_dir_all(&nested_staging).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to recreate staging placeholder {:?}: {error}",
                nested_staging
            );
            return Err(IpcError::Internal(
                "Unable to revert staged project directory.".into(),
            ));
        }
    }

    let final_original = staging.final_dir.join(PROJECT_DIR_ORIGINAL);
    let staged_original = nested_staging.join(PROJECT_DIR_ORIGINAL);
    if fs::metadata(&final_original).await.is_ok() {
        if let Err(error) = fs::rename(&final_original, &staged_original).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to revert originals {:?} -> {:?}: {error}",
                final_original, staged_original
            );
            return Err(IpcError::Internal(
                "Unable to revert staged project directory.".into(),
            ));
        }
    }

    let final_artifacts = staging.final_dir.join(PROJECT_DIR_ARTIFACTS);
    let staged_artifacts = nested_staging.join(PROJECT_DIR_ARTIFACTS);
    if fs::metadata(&final_artifacts).await.is_ok() {
        if let Err(error) = fs::rename(&final_artifacts, &staged_artifacts).await {
            error!(
                target: "ipc::projects::file_operations",
                "failed to revert artifacts {:?} -> {:?}: {error}",
                final_artifacts, staged_artifacts
            );
            return Err(IpcError::Internal(
                "Unable to revert staged project directory.".into(),
            ));
        }
    }

    if let Err(error) = fs::rename(&staging.final_dir, &staging.staging_dir).await {
        error!(
            target: "ipc::projects::file_operations",
            "failed to revert project directory {:?} -> {:?}: {error}",
            staging.final_dir, staging.staging_dir
        );
        return Err(IpcError::Internal(
            "Unable to revert staged project directory.".into(),
        ));
    }

    Ok(())
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
        let file_id = Uuid::new_v4();
        let stored_rel_path =
            build_original_stored_rel_path(file_id, &validated_file.original_name);
        let destination_path = project_dir.join(&stored_rel_path);

        if let Some(parent) = destination_path.parent() {
            if let Err(error) = fs::create_dir_all(parent).await {
                error!(
                    target: "ipc::projects::file_operations",
                    "failed to ensure parent directory {:?}: {error}",
                    parent
                );
                return Err(IpcError::Internal(
                    "Unable to prepare storage directory for imported files.".into(),
                ));
            }
        }

        if file_exists(&destination_path).await {
            error!(
                target: "ipc::projects::file_operations",
                "naming collision detected while importing into {:?}",
                destination_path
            );
            return Err(IpcError::Internal(
                "Detected a naming collision while importing files.".into(),
            ));
        }

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

        // Collect file metadata including checksum if available
        let (size_bytes, checksum_sha256, hash_sha256) =
            match compute_sha256_streaming(&destination_path).await {
                Ok((bytes, hash)) => (Some(bytes), Some(hash.clone()), Some(hash)),
                Err(hash_error) => {
                    warn!(
                        target: "ipc::projects::file_operations",
                        "failed to compute checksum for {:?}: {hash_error}",
                        destination_path
                    );
                    let fallback_size = get_file_size(&destination_path)
                        .await
                        .and_then(|len| i64::try_from(len).ok());
                    (fallback_size, None, None)
                }
            };

        // Create database record
        let db_record = NewProjectFile {
            id: file_id,
            project_id,
            original_name: validated_file.original_name.clone(),
            original_path: validated_file.canonical_path.display().to_string(),
            stored_rel_path: stored_rel_path.clone(),
            ext: validated_file.extension.clone(),
            size_bytes,
            checksum_sha256,
            import_status: ProjectFileImportStatus::Imported,
            role: ProjectFileRole::Source,
            storage_state: ProjectFileStorageState::Copied,
            mime_type: None,
            hash_sha256,
            importer: None,
        };

        imported_files.push(ImportedFile { db_record });
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
    use crate::ipc::commands::projects::utils::build_staging_original_stored_rel_path;
    use crate::settings::{AppSettings, SettingsManager};
    use sha2::{Digest, Sha256};
    use std::fs as stdfs;
    use std::path::Path;
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

    #[tokio::test]
    async fn test_compute_sha256_streaming() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let content = "Hello, World!";

        fs::write(&file_path, content).await.unwrap();

        let (bytes, hash) = compute_sha256_streaming(&file_path).await.unwrap();

        assert_eq!(bytes, content.len() as i64);
        assert_eq!(
            hash,
            "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
        );
    }

    #[tokio::test]
    async fn test_staging_copy_and_promotion_flow() {
        let temp_dir = TempDir::new().unwrap();
        let app_root = temp_dir.path().join("app");
        stdfs::create_dir_all(&app_root).unwrap();

        let settings = AppSettings {
            app_folder: app_root.clone(),
            auto_convert_on_open: true,
            theme: "light".into(),
            ui_language: "en-US".into(),
            default_source_language: "en-US".into(),
            default_target_language: "it-IT".into(),
            default_xliff_version: "2.0".into(),
            show_notifications: true,
            enable_sound_notifications: false,
            max_parallel_conversions: 4,
            database_journal_mode: "WAL".into(),
            database_synchronous: "NORMAL".into(),
        };

        let settings_manager =
            SettingsManager::new(temp_dir.path().join("settings.yaml"), settings);

        let project_id = Uuid::new_v4();
        let staging = create_project_staging_dir(&settings_manager, "Staging Demo", project_id)
            .await
            .expect("staging directory to be created");

        assert!(directory_exists(&staging.staging_dir).await);
        assert!(!directory_exists(&staging.final_dir).await);

        let source_path = temp_dir.path().join("sample.txt");
        let content = b"staging integration test payload";
        fs::write(&source_path, content).await.unwrap();

        let file_id = Uuid::new_v4();
        let staged_rel_path = build_staging_original_stored_rel_path(file_id, "sample.txt");

        let metadata = copy_file_into_staging(&source_path, &staging.staging_dir, &staged_rel_path)
            .await
            .expect("copy into staging");

        assert_eq!(metadata.size_bytes, content.len() as i64);

        let mut hasher = Sha256::new();
        hasher.update(content);
        let expected_hash = format!("{:x}", hasher.finalize());
        assert_eq!(metadata.hash_sha256, expected_hash);

        let staging_destination = staging.staging_dir.join(&staged_rel_path);
        assert!(file_exists(&staging_destination).await);

        promote_staging_directory(&staging)
            .await
            .expect("promotion to succeed");

        assert!(!directory_exists(&staging.staging_dir).await);

        let final_original_dir = staging.final_dir.join(PROJECT_DIR_ORIGINAL);
        assert!(directory_exists(&final_original_dir).await);

        let staged_filename = Path::new(&staged_rel_path)
            .file_name()
            .expect("staged file name present");
        let final_file_path = final_original_dir.join(staged_filename);
        assert!(file_exists(&final_file_path).await);

        let final_contents = fs::read(&final_file_path).await.unwrap();
        assert_eq!(final_contents, content);

        assert!(
            fs::metadata(staging.final_dir.join(PROJECT_DIR_STAGING))
                .await
                .is_err(),
            "staging placeholder should be removed after promotion"
        );
    }
}

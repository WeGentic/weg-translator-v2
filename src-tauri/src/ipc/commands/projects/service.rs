//! Project management service layer
//!
//! This module contains the core business logic for project management operations.
//! It orchestrates validation, file operations, database operations, and artifact
//! management to provide high-level project management functionality.

use std::collections::HashSet;
use std::convert::TryFrom;
use std::path::PathBuf;

use log::{error, info, warn};
use serde::Deserialize;
use serde_json::Value;
use tokio::fs;
use uuid::Uuid;

use super::artifacts::{
    JliffConversionResult, UpdateJliffSegmentResult, build_conversions_plan,
    convert_xliff_to_jliff, read_project_artifact, update_jliff_segment,
};
use super::constants::{
    DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_XLIFF_VERSION, LOCAL_OWNER_USER_ID,
};
use super::dto_mappers::{project_details_to_dto, project_file_to_dto, project_list_to_dto};
use super::file_operations::{
    CreatedProjectStagingDirectory, cleanup_project_directory, copy_file_into_staging,
    create_project_staging_dir, import_files_to_project, promote_staging_directory,
    remove_multiple_artifacts, revert_promoted_directory,
};
use super::utils::{build_staging_original_stored_rel_path, resolve_project_relative_path};
use super::validation::{
    validate_conversion_status, validate_optional_language, validate_pagination_params,
    validate_project_files, validate_project_name, validate_project_type, validate_transunit_id,
};
use crate::db::constants::{CONVERTIBLE_EXTENSIONS, SKIP_CONVERSION_EXTENSIONS};
use crate::db::error::DbError;
use crate::db::{
    DbManager, FileTargetStatus, NewProject, NewProjectFile, NewProjectFileConversion,
    ProjectFileConversionRequest, ProjectFileConversionRow, ProjectFileConversionStatus,
    ProjectFileImportStatus, ProjectFileRole, ProjectFileStorageState, ProjectLifecycleStatus,
    ProjectStatus,
};
use crate::ipc::dto::{
    AddFilesResponseDto, CreateProjectRequest, CreateProjectResponse, EnsureConversionsPlanDto,
    ProjectDetailsDto, ProjectListItemDto,
};
use crate::ipc::error::IpcError;
use crate::settings::SettingsManager;

/// High-level project management service
///
/// This service provides the main business logic for project operations,
/// coordinating between validation, file operations, database operations,
/// and artifact management.
pub struct ProjectService;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SeedProjectFileInput<'a> {
    pub original_name: &'a str,
    pub original_path: &'a str,
    pub extension: &'a str,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SeededProjectFile {
    pub file_id: Uuid,
    pub original_name: String,
    pub original_path: String,
    pub staged_rel_path: String,
    pub extension: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SeededLanguagePair {
    pub pair_id: Uuid,
    pub src_lang: String,
    pub trg_lang: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SeedProjectMetadataResult {
    pub project_id: Uuid,
    pub slug: String,
    pub files: Vec<SeededProjectFile>,
    pub language_pairs: Vec<SeededLanguagePair>,
}

impl ProjectService {
    #[allow(dead_code)]
    pub async fn seed_project_metadata(
        db: &DbManager,
        project: &NewProject,
        files: &[SeedProjectFileInput<'_>],
        language_pairs: &[(String, String)],
    ) -> Result<SeedProjectMetadataResult, IpcError> {
        let _guard = db.write_lock.lock().await;
        let pool = db.pool().await;
        let mut tx = pool
            .begin()
            .await
            .map_err(|error| IpcError::from(DbError::from(error)))?;

        db.insert_project(project, &mut tx)
            .await
            .map_err(IpcError::from)?;

        let mut pair_set = HashSet::new();
        let mut seeded_pairs = Vec::new();

        for (src, tgt) in language_pairs {
            let src_trimmed = src.trim();
            let tgt_trimmed = tgt.trim();

            if src_trimmed.is_empty() || tgt_trimmed.is_empty() {
                continue;
            }

            let key = (src_trimmed.to_string(), tgt_trimmed.to_string());
            if !pair_set.insert(key.clone()) {
                continue;
            }

            let pair_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO project_language_pairs (pair_id, project_id, src_lang, trg_lang)
                 VALUES (?1, ?2, ?3, ?4)",
            )
            .bind(&pair_id.to_string())
            .bind(&project.id.to_string())
            .bind(&key.0)
            .bind(&key.1)
            .execute(tx.as_mut())
            .await
            .map_err(|error| IpcError::from(DbError::from(error)))?;

            seeded_pairs.push(SeededLanguagePair {
                pair_id,
                src_lang: key.0,
                trg_lang: key.1,
            });
        }

        let mut seeded_files = Vec::new();
        let mut conversion_rows: Vec<NewProjectFileConversion> = Vec::new();

        for input in files {
            let file_id = Uuid::new_v4();
            let staged_rel_path =
                build_staging_original_stored_rel_path(file_id, input.original_name);

            let new_file = NewProjectFile {
                id: file_id,
                project_id: project.id,
                original_name: input.original_name.to_string(),
                original_path: input.original_path.to_string(),
                stored_rel_path: staged_rel_path.clone(),
                ext: input.extension.to_string(),
                size_bytes: None,
                checksum_sha256: None,
                import_status: ProjectFileImportStatus::Imported,
                role: ProjectFileRole::Source,
                storage_state: ProjectFileStorageState::Staged,
                mime_type: None,
                hash_sha256: None,
                importer: None,
            };

            db.insert_project_file(&new_file, &mut tx)
                .await
                .map_err(IpcError::from)?;

            seeded_files.push(SeededProjectFile {
                file_id,
                original_name: input.original_name.to_string(),
                original_path: input.original_path.to_string(),
                staged_rel_path,
                extension: input.extension.to_string(),
            });
        }

        for file in &seeded_files {
            for pair in &seeded_pairs {
                let target_id = Uuid::new_v4();
                sqlx::query(
                    "INSERT INTO file_targets (file_target_id, file_id, pair_id, status)
                     VALUES (?1, ?2, ?3, ?4)",
                )
                .bind(&target_id.to_string())
                .bind(&file.file_id.to_string())
                .bind(&pair.pair_id.to_string())
                .bind("PENDING")
                .execute(tx.as_mut())
                .await
                .map_err(|error| IpcError::from(DbError::from(error)))?;

                let ext = file.extension.to_lowercase();
                if SKIP_CONVERSION_EXTENSIONS.contains(&ext.as_str())
                    || !CONVERTIBLE_EXTENSIONS.contains(&ext.as_str())
                {
                    continue;
                }

                conversion_rows.push(NewProjectFileConversion {
                    id: Uuid::new_v4(),
                    project_file_id: file.file_id,
                    src_lang: pair.src_lang.clone(),
                    tgt_lang: pair.trg_lang.clone(),
                    version: DEFAULT_XLIFF_VERSION.to_string(),
                    paragraph: false,
                    embed: false,
                    xliff_rel_path: None,
                    jliff_rel_path: None,
                    tag_map_rel_path: None,
                    status: ProjectFileConversionStatus::Pending,
                    started_at: None,
                    completed_at: None,
                    failed_at: None,
                    error_message: None,
                });
            }
        }

        db.insert_project_file_conversions(&conversion_rows, &mut tx)
            .await
            .map_err(IpcError::from)?;

        tx.commit()
            .await
            .map_err(|error| IpcError::from(DbError::from(error)))?;

        Ok(SeedProjectMetadataResult {
            project_id: project.id,
            slug: project.slug.clone(),
            files: seeded_files,
            language_pairs: seeded_pairs,
        })
    }

    #[allow(dead_code)]
    pub async fn stage_original_files(
        db: &DbManager,
        staging: &CreatedProjectStagingDirectory,
        seeded: &SeedProjectMetadataResult,
    ) -> Result<(), IpcError> {
        for file in &seeded.files {
            let source_path = PathBuf::from(&file.original_path);
            let staged_rel_path = &file.staged_rel_path;
            let job_key = format!("COPY_FILE::{}::{}", seeded.project_id, file.file_id);

            let staging_result =
                copy_file_into_staging(&source_path, &staging.staging_dir, staged_rel_path).await;

            let metadata = match staging_result {
                Ok(metadata) => metadata,
                Err(error) => {
                    let message = format!(
                        "Failed to stage project file {}: {error}",
                        file.original_name
                    );
                    let _ = db
                        .insert_job_row(
                            "COPY_FILE",
                            seeded.project_id,
                            "FAILED",
                            None,
                            None,
                            Some(&message),
                            1,
                            job_key.as_str(),
                        )
                        .await;
                    Self::handle_staging_failure(db, seeded.project_id, &staging.staging_dir).await;
                    return Err(error);
                }
            };

            if let Err(error) = db
                .update_project_file_staging_metadata(
                    file.file_id,
                    metadata.size_bytes,
                    &metadata.hash_sha256,
                )
                .await
            {
                let message = format!(
                    "Unable to persist staged metadata for {}: {error}",
                    file.original_name
                );
                let _ = db
                    .insert_job_row(
                        "COPY_FILE",
                        seeded.project_id,
                        "FAILED",
                        None,
                        None,
                        Some(&message),
                        1,
                        job_key.as_str(),
                    )
                    .await;
                Self::handle_staging_failure(db, seeded.project_id, &staging.staging_dir).await;
                return Err(IpcError::from(error));
            }

            if let Err(error) = db
                .insert_job_row(
                    "COPY_FILE",
                    seeded.project_id,
                    "SUCCEEDED",
                    None,
                    None,
                    None,
                    1,
                    job_key.as_str(),
                )
                .await
            {
                let message = format!(
                    "Unable to log COPY_FILE job for {}: {error}",
                    file.original_name
                );
                let _ = db
                    .insert_job_row(
                        "COPY_FILE",
                        seeded.project_id,
                        "FAILED",
                        None,
                        None,
                        Some(&message),
                        1,
                        job_key.as_str(),
                    )
                    .await;
                Self::handle_staging_failure(db, seeded.project_id, &staging.staging_dir).await;
                return Err(IpcError::from(error));
            }
        }

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn promote_staged_project(
        db: &DbManager,
        staging: &CreatedProjectStagingDirectory,
        seeded: &SeedProjectMetadataResult,
    ) -> Result<(), IpcError> {
        if let Err(error) = promote_staging_directory(staging).await {
            error!(
                target: "ipc::projects::service",
                "failed to promote staging directory {:?}: {error}",
                staging.staging_dir
            );
            Self::handle_staging_failure(db, seeded.project_id, &staging.staging_dir).await;
            return Err(error);
        }

        if let Err(db_error) = db.finalize_staged_project_files(seeded.project_id).await {
            error!(
                target: "ipc::projects::service",
                "failed to finalize staged files for project {}: {db_error}",
                seeded.project_id
            );
            let _ = revert_promoted_directory(staging).await;
            let _ = db
                .update_project_lifecycle_status(seeded.project_id, ProjectLifecycleStatus::Error)
                .await;
            return Err(IpcError::from(db_error));
        }

        let final_root = staging.final_dir.to_string_lossy().to_string();
        if let Err(db_error) = db
            .update_project_root_path(seeded.project_id, &final_root)
            .await
        {
            error!(
                target: "ipc::projects::service",
                "failed to update project root path for {}: {db_error}",
                seeded.project_id
            );
            let _ = revert_promoted_directory(staging).await;
            let _ = db
                .update_project_lifecycle_status(seeded.project_id, ProjectLifecycleStatus::Error)
                .await;
            return Err(IpcError::from(db_error));
        }

        if let Err(db_error) = db
            .update_project_lifecycle_status(seeded.project_id, ProjectLifecycleStatus::Ready)
            .await
        {
            error!(
                target: "ipc::projects::service",
                "failed to mark project {} as READY after promotion: {db_error}",
                seeded.project_id
            );
            return Err(IpcError::from(db_error));
        }

        Ok(())
    }

    /// Creates a new project with the provided files
    ///
    /// This operation:
    /// 1. Validates the project name and type
    /// 2. Validates and processes the provided files
    /// 3. Creates the project directory structure
    /// 4. Imports files into the project directory
    /// 5. Persists project and file metadata to the database
    /// 6. Handles cleanup on failure
    ///
    /// # Arguments
    /// * `settings` - Settings manager for app folder access
    /// * `db` - Database manager for persistence
    /// * `request` - Project creation request with metadata and files
    ///
    /// # Returns
    /// Project creation response with ID, slug, and file count
    ///
    /// # Errors
    /// Returns validation errors for invalid inputs or internal errors
    /// for filesystem/database failures. On error, attempts to clean up
    /// any partially created project directory.
    ///
    /// # Transaction Safety
    /// This operation is not fully atomic. On failure, the project directory
    /// may be partially created but the database transaction will be rolled back.
    pub async fn create_project_with_files(
        settings: &SettingsManager,
        db: &DbManager,
        request: CreateProjectRequest,
    ) -> Result<CreateProjectResponse, IpcError> {
        // Validate project metadata
        let project_name = validate_project_name(&request.name)?;
        let project_type = validate_project_type(&request.project_type)?;

        // Process optional language settings
        let default_src_lang = validate_optional_language(request.default_src_lang)?
            .or_else(|| Some(DEFAULT_SOURCE_LANGUAGE.into()));
        let default_tgt_lang = validate_optional_language(request.default_tgt_lang)?
            .or_else(|| Some(DEFAULT_TARGET_LANGUAGE.into()));

        // Validate and process files
        let validated_files = validate_project_files(request.files).await?;

        // Generate identifiers and prepare staging directory
        let project_id = Uuid::new_v4();
        let staging_dir = create_project_staging_dir(settings, &project_name, project_id).await?;
        let final_root_path = staging_dir.final_dir.to_string_lossy().to_string();

        // Prepare project record for database (inserted during seeding)
        let project_record = NewProject {
            id: project_id,
            name: project_name.clone(),
            slug: super::utils::build_project_slug(&project_name, project_id),
            project_type,
            root_path: final_root_path.clone(),
            status: ProjectStatus::Active,
            owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
            client_id: None,
            domain_id: None,
            lifecycle_status: ProjectLifecycleStatus::Creating,
            archived_at: None,
            default_src_lang,
            default_tgt_lang,
            metadata: None,
        };

        // Prepare language pairs using project defaults
        let mut language_pairs = Vec::new();
        if let (Some(src), Some(tgt)) = (
            project_record.default_src_lang.as_ref(),
            project_record.default_tgt_lang.as_ref(),
        ) {
            language_pairs.push((src.clone(), tgt.clone()));
        }

        // Prepare file inputs for metadata seeding
        let staged_file_data: Vec<(String, String, String)> = validated_files
            .iter()
            .map(|file| {
                (
                    file.original_name.clone(),
                    file.canonical_path.to_string_lossy().to_string(),
                    file.extension.clone(),
                )
            })
            .collect();

        let seed_inputs: Vec<SeedProjectFileInput<'_>> = staged_file_data
            .iter()
            .map(|(name, path, ext)| SeedProjectFileInput {
                original_name: name.as_str(),
                original_path: path.as_str(),
                extension: ext.as_str(),
            })
            .collect();

        // Seed project metadata, ensuring transactional insert of project/files/pairs/targets
        let seeded_metadata = match Self::seed_project_metadata(
            db,
            &project_record,
            &seed_inputs,
            &language_pairs,
        )
        .await
        {
            Ok(result) => result,
            Err(error) => {
                if let Err(cleanup_error) =
                    tokio::fs::remove_dir_all(&staging_dir.staging_dir).await
                {
                    error!(
                        target: "ipc::projects::service",
                        "failed to cleanup staging directory {:?} after seed failure: {cleanup_error}",
                        staging_dir.staging_dir
                    );
                }
                return Err(error);
            }
        };

        if let Err(status_error) = db
            .update_project_lifecycle_status(project_id, ProjectLifecycleStatus::InProgress)
            .await
        {
            error!(
                target: "ipc::projects::service",
                "failed to mark project {project_id} as IN_PROGRESS: {status_error}"
            );
            let _ = tokio::fs::remove_dir_all(&staging_dir.staging_dir).await;
            return Err(IpcError::from(status_error));
        }

        // Stage originals into the staging directory, computing size/hash metadata
        Self::stage_original_files(db, &staging_dir, &seeded_metadata).await?;

        // Promote staged directory into final location and finalise metadata/lifecycle
        Self::promote_staged_project(db, &staging_dir, &seeded_metadata).await?;

        info!(
            target: "ipc::projects::service",
            "created project {project_id} with {count} staged file(s)",
            count = seeded_metadata.files.len()
        );

        Ok(CreateProjectResponse {
            project_id: project_id.to_string(),
            slug: seeded_metadata.slug,
            folder: final_root_path,
            file_count: seeded_metadata.files.len(),
        })
    }

    /// Retrieves detailed information about a project
    ///
    /// Loads project details including all files and conversion records,
    /// then converts to DTO format for API response.
    ///
    /// # Arguments
    /// * `db` - Database manager for data access
    /// * `project_id` - UUID of the project to retrieve
    ///
    /// # Returns
    /// Complete project details including nested file and conversion data
    pub async fn get_project_details(
        db: &DbManager,
        project_id: Uuid,
    ) -> Result<ProjectDetailsDto, IpcError> {
        let details = db.list_project_details(project_id).await?;
        Ok(project_details_to_dto(&details))
    }

    /// Adds additional files to an existing project
    ///
    /// This operation:
    /// 1. Validates the project exists
    /// 2. Validates and processes the new files
    /// 3. Imports files into the project directory
    /// 4. Updates the database with new file records
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the target project
    /// * `file_paths` - Paths to files to add to the project
    ///
    /// # Returns
    /// Information about successfully added files
    ///
    /// # Errors
    /// Returns validation errors for invalid files or internal errors
    /// for operation failures. File validation mirrors project creation.
    pub async fn add_files_to_project(
        db: &DbManager,
        project_id: Uuid,
        file_paths: Vec<String>,
    ) -> Result<AddFilesResponseDto, IpcError> {
        // Validate files early
        let validated_files = validate_project_files(file_paths).await?;

        // Get project root (validates project exists)
        let project_root = db.project_root_path(project_id).await?;

        // Import files to project directory
        let imported_files =
            import_files_to_project(&project_root, project_id, &validated_files).await?;

        // Extract database records
        let file_records: Vec<_> = imported_files.iter().map(|f| f.db_record.clone()).collect();

        // Persist to database
        let inserted_files = db.add_files_to_project(project_id, &file_records).await?;

        // Ensure conversion stubs exist for convertible formats
        if !inserted_files.is_empty() {
            let (default_src, default_tgt) = db.project_language_defaults(project_id).await?;
            let src_lang = default_src.unwrap_or_else(|| DEFAULT_SOURCE_LANGUAGE.to_string());
            let tgt_lang = default_tgt.unwrap_or_else(|| DEFAULT_TARGET_LANGUAGE.to_string());
            let conversion_request =
                ProjectFileConversionRequest::new(&src_lang, &tgt_lang, DEFAULT_XLIFF_VERSION);

            for file in &inserted_files {
                let ext = file.ext.to_lowercase();
                if SKIP_CONVERSION_EXTENSIONS.contains(&ext.as_str()) {
                    continue;
                }
                if !CONVERTIBLE_EXTENSIONS.contains(&ext.as_str()) {
                    continue;
                }

                // Ensure a pending conversion row exists for this file
                let _ = db
                    .find_or_create_conversion_for_file(file.id, &conversion_request)
                    .await?;
            }
        }

        // Convert to DTOs
        let inserted_dtos = inserted_files
            .iter()
            .map(|file| project_file_to_dto(file))
            .collect::<Vec<_>>();

        Ok(AddFilesResponseDto {
            inserted: inserted_dtos,
            inserted_count: file_records.len(),
        })
    }

    /// Removes a file from a project
    ///
    /// This operation:
    /// 1. Retrieves project details to locate the file
    /// 2. Removes the file record from the database
    /// 3. Cleans up the physical file and associated artifacts
    /// 4. Removes empty directories
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project
    /// * `project_file_id` - UUID of the file to remove
    ///
    /// # Returns
    /// Number of database records removed (should be 1 for success)
    ///
    /// # Cleanup
    /// Removes associated artifacts including:
    /// - The original imported file
    /// - Any generated XLIFF files
    /// - Any generated JLIFF files
    /// - Any generated tag mapping files
    pub async fn remove_project_file(
        db: &DbManager,
        project_id: Uuid,
        project_file_id: Uuid,
    ) -> Result<u64, IpcError> {
        let details = db.list_project_details(project_id).await?;
        let root_path = PathBuf::from(&details.root_path);

        // Find the target file entry before deletion
        let target_file = details
            .files
            .iter()
            .find(|f| f.file.id.to_string() == project_file_id.to_string())
            .cloned();

        // Remove from database first
        let removed_count = db.remove_project_file(project_id, project_file_id).await?;

        // Clean up filesystem artifacts
        if let Some(file_entry) = target_file {
            // Remove the main project file
            let main_file_path = vec![file_entry.file.stored_rel_path.as_str()];
            remove_multiple_artifacts(&root_path, main_file_path.into_iter(), "project file").await;

            // Collect all conversion artifact paths
            let artifact_paths: Vec<&str> = file_entry
                .conversions
                .iter()
                .filter_map(|conv| conv.xliff_rel_path.as_deref())
                .chain(
                    file_entry
                        .conversions
                        .iter()
                        .filter_map(|conv| conv.jliff_rel_path.as_deref()),
                )
                .chain(
                    file_entry
                        .conversions
                        .iter()
                        .filter_map(|conv| conv.tag_map_rel_path.as_deref()),
                )
                .collect();

            // Remove all conversion artifacts
            remove_multiple_artifacts(
                &root_path,
                artifact_paths.into_iter(),
                "conversion artifact",
            )
            .await;
        }

        Ok(removed_count)
    }

    /// Deletes an entire project
    ///
    /// This operation:
    /// 1. Attempts to get project root path for cleanup
    /// 2. Removes all project data from database
    /// 3. Removes project directory from filesystem
    /// 4. Tolerates missing directories for robustness
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project to delete
    ///
    /// # Returns
    /// Number of database records removed
    ///
    /// # Robustness
    /// The operation proceeds even if the project directory is missing,
    /// allowing cleanup of orphaned database records.
    pub async fn delete_project(db: &DbManager, project_id: Uuid) -> Result<u64, IpcError> {
        // Try to get project root for filesystem cleanup
        let project_root = match db.project_root_path(project_id).await {
            Ok(path) => Some(path),
            Err(_) => {
                // Project might already be partially deleted, continue with DB cleanup
                None
            }
        };

        // Remove from database
        let deleted_count = db.delete_project(project_id).await?;

        // Clean up filesystem if project was found and deleted
        if deleted_count > 0 {
            if let Some(root_path) = project_root {
                cleanup_project_directory(&root_path).await;
            }
        }

        Ok(deleted_count)
    }

    /// Lists projects with pagination
    ///
    /// Retrieves project list with basic metadata for dashboard display.
    /// Validates pagination parameters and converts results to DTOs.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `limit` - Optional limit for number of results
    /// * `offset` - Optional offset for pagination
    ///
    /// # Returns
    /// Vector of project list items with basic metadata
    pub async fn list_projects(
        db: &DbManager,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<ProjectListItemDto>, IpcError> {
        let (validated_limit, validated_offset) = validate_pagination_params(limit, offset);

        let records = db.list_projects(validated_limit, validated_offset).await?;
        Ok(project_list_to_dto(records))
    }

    /// Builds a plan for ensuring project conversions
    ///
    /// Analyzes project files and generates a conversion plan for any
    /// files that don't have XLIFF artifacts yet.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project to analyze
    ///
    /// # Returns
    /// Conversion plan with tasks for missing XLIFF files
    pub async fn ensure_project_conversions_plan(
        db: &DbManager,
        project_id: Uuid,
    ) -> Result<EnsureConversionsPlanDto, IpcError> {
        build_conversions_plan(db, project_id).await
    }

    /// Converts an XLIFF file to JLIFF format
    ///
    /// Delegates to the artifacts module for the actual conversion,
    /// providing a service-level interface.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project
    /// * `conversion_id` - UUID of the conversion record
    /// * `xliff_abs_path` - Absolute path to XLIFF file
    /// * `operator` - Optional operator name
    /// * `schema_abs_path` - Optional schema path for validation
    ///
    /// # Returns
    /// Information about generated JLIFF artifacts
    pub async fn convert_xliff_to_jliff(
        db: &DbManager,
        project_id: Uuid,
        conversion_id: Uuid,
        xliff_abs_path: String,
        operator: Option<String>,
        schema_abs_path: Option<String>,
    ) -> Result<JliffConversionResult, IpcError> {
        convert_xliff_to_jliff(
            db,
            project_id,
            conversion_id,
            xliff_abs_path,
            operator,
            schema_abs_path,
        )
        .await
    }

    /// Reads a project artifact by relative path
    ///
    /// Provides safe access to project artifacts with path validation.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project
    /// * `rel_path` - Relative path to the artifact
    ///
    /// # Returns
    /// Contents of the artifact file
    pub async fn read_project_artifact(
        db: &DbManager,
        project_id: Uuid,
        rel_path: String,
    ) -> Result<String, IpcError> {
        read_project_artifact(db, project_id, &rel_path).await
    }

    /// Updates a segment in a JLIFF document
    ///
    /// Validates inputs and delegates to the artifacts module for
    /// the actual update operation with file locking.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `project_id` - UUID of the project
    /// * `jliff_rel_path` - Relative path to JLIFF file
    /// * `transunit_id` - ID of translation unit to update
    /// * `new_target` - New translation text
    ///
    /// # Returns
    /// Information about the update operation
    pub async fn update_jliff_segment(
        db: &DbManager,
        project_id: Uuid,
        jliff_rel_path: String,
        transunit_id: String,
        new_target: String,
    ) -> Result<UpdateJliffSegmentResult, IpcError> {
        let validated_id = validate_transunit_id(&transunit_id)?;
        update_jliff_segment(db, project_id, &jliff_rel_path, validated_id, new_target).await
    }

    /// Updates conversion status in the database
    ///
    /// Validates status and updates conversion metadata including
    /// timestamps and artifact paths.
    ///
    /// # Arguments
    /// * `db` - Database manager for operations
    /// * `conversion_id` - UUID of the conversion to update
    /// * `status` - New status string
    /// * `xliff_rel_path` - Optional XLIFF artifact path
    /// * `jliff_rel_path` - Optional JLIFF artifact path
    /// * `tag_map_rel_path` - Optional tag map artifact path
    /// * `error_message` - Optional error message for failed conversions
    ///
    /// # Returns
    /// Unit type on success
    pub async fn update_conversion_status(
        db: &DbManager,
        conversion_id: Uuid,
        status: String,
        xliff_rel_path: Option<String>,
        jliff_rel_path: Option<String>,
        tag_map_rel_path: Option<String>,
        error_message: Option<String>,
        xliff_validation: Option<Value>,
    ) -> Result<(), IpcError> {
        use crate::db::ProjectFileConversionStatus as S;

        let (conversion, project_id) = db
            .load_conversion_with_project(conversion_id)
            .await
            .map_err(IpcError::from)?;

        let sanitized_xliff_rel = xliff_rel_path
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string());

        let xliff_validation_payload = match xliff_validation
            .map(serde_json::from_value::<ValidationPayload>)
        {
            Some(Ok(value)) => Some(value),
            Some(Err(error)) => {
                error!(
                    target: "ipc::projects::service",
                    "failed to parse XLIFF validation payload for conversion {conversion_id}: {error}"
                );
                return Err(IpcError::Validation(
                    "Invalid validation payload supplied for conversion status update.".into(),
                ));
            }
            None => None,
        };

        let error_payload = error_message.clone();

        // Validate and parse status
        let validated_status = validate_conversion_status(&status)?;
        let parsed_status = match validated_status {
            "pending" => S::Pending,
            "running" => S::Running,
            "completed" => S::Completed,
            "failed" => S::Failed,
            _ => unreachable!(), // validate_conversion_status ensures this
        };

        if matches!(parsed_status, S::Completed) && sanitized_xliff_rel.is_none() {
            return Err(IpcError::Validation(
                "XLIFF path is required when marking a conversion as completed.".into(),
            ));
        }

        // Generate timestamp
        let timestamp = time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_else(|_| time::OffsetDateTime::now_utc().to_string());

        // Determine which timestamp field to set based on status
        let (started_at, completed_at, failed_at) = match parsed_status {
            S::Running => (Some(timestamp), None, None),
            S::Completed => (None, Some(timestamp), None),
            S::Failed => (None, None, Some(timestamp)),
            S::Pending => (None, None, None),
        };

        // Update in database
        db.upsert_conversion_status(
            conversion_id,
            parsed_status,
            sanitized_xliff_rel.clone(),
            jliff_rel_path,
            tag_map_rel_path,
            error_message,
            started_at,
            completed_at,
            failed_at,
        )
        .await?;

        match parsed_status {
            S::Completed => {
                let rel_path = sanitized_xliff_rel
                    .clone()
                    .expect("validated to exist when status is Completed");

                let (src_lang, tgt_lang) =
                    Self::resolve_conversion_languages(db, project_id, &conversion).await?;
                let file_target_id = db
                    .find_file_target(project_id, conversion.project_file_id, &src_lang, &tgt_lang)
                    .await
                    .map_err(IpcError::from)?;

                if let Some(file_target_id) = file_target_id {
                    let project_root = db
                        .project_root_path(project_id)
                        .await
                        .map_err(IpcError::from)?;
                    let artifact_abs_path = resolve_project_relative_path(
                        &project_root,
                        &rel_path,
                        "resolve generated XLIFF artifact",
                    )?;

                    let metadata = fs::metadata(&artifact_abs_path).await.map_err(|error| {
                        error!(
                            target: "ipc::projects::service",
                            "failed to read metadata for XLIFF artifact {:?}: {error}",
                            artifact_abs_path
                        );
                        IpcError::Internal("Unable to inspect generated XLIFF artifact.".into())
                    })?;

                    let size_bytes = match i64::try_from(metadata.len()) {
                        Ok(value) => Some(value),
                        Err(_) => {
                            warn!(
                                target: "ipc::projects::service",
                                "XLIFF artifact {rel_path} has size {} bytes exceeding i64 range; persisting without size metadata",
                                metadata.len()
                            );
                            None
                        }
                    };

                    let artifact_id = db
                        .upsert_artifact_row(
                            file_target_id,
                            "xliff",
                            &rel_path,
                            size_bytes,
                            None,
                            Some("OpenXLIFF"),
                            "GENERATED",
                        )
                        .await
                        .map_err(IpcError::from)?;

                    if let Some(validation) = xliff_validation_payload.as_ref() {
                        let validator = validation
                            .validator
                            .as_deref()
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or("xliff_schema");
                        let payload = serde_json::json!({
                            "schemaPath": validation.schema_path,
                            "skipped": validation.skipped.unwrap_or(false),
                            "message": validation.message,
                        });
                        if let Err(validation_error) = db
                            .insert_validation_record(
                                artifact_id,
                                validator,
                                validation.passed.unwrap_or(true),
                                Some(&payload),
                            )
                            .await
                        {
                            warn!(
                                target: "ipc::projects::service",
                                "failed to persist XLIFF validation for artifact {artifact_id}: {validation_error}"
                            );
                        }
                    }

                    db.update_file_target_status(file_target_id, FileTargetStatus::Extracted)
                        .await
                        .map_err(IpcError::from)?;

                    let job_key = format!("EXTRACT_XLIFF::{}::{}", project_id, file_target_id);

                    if let Err(job_error) = db
                        .insert_job_row(
                            "EXTRACT_XLIFF",
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
                            target: "ipc::projects::service",
                            "failed to log EXTRACT_XLIFF success for conversion {conversion_id}: {job_error}"
                        );
                    }
                } else {
                    warn!(
                        target: "ipc::projects::service",
                        "conversion {conversion_id} completed but no file_target row for {src_lang}->{tgt_lang}; skipping artifact upsert"
                    );
                }
            }
            S::Failed => {
                let (src_lang, tgt_lang) =
                    Self::resolve_conversion_languages(db, project_id, &conversion).await?;
                let file_target_id = db
                    .find_file_target(project_id, conversion.project_file_id, &src_lang, &tgt_lang)
                    .await
                    .map_err(IpcError::from)?;

                if let Some(file_target_id) = file_target_id {
                    let job_key = format!("EXTRACT_XLIFF::{}::{}", project_id, file_target_id);
                    db.update_file_target_status(file_target_id, FileTargetStatus::Failed)
                        .await
                        .map_err(IpcError::from)?;

                    let mut message = error_payload
                        .clone()
                        .unwrap_or_else(|| "XLIFF extraction failed.".to_string());
                    if message.trim().is_empty() {
                        message = "XLIFF extraction failed.".to_string();
                    }
                    let message_ref = message.as_str();

                    if let Err(job_error) = db
                        .insert_job_row(
                            "EXTRACT_XLIFF",
                            project_id,
                            "FAILED",
                            Some(file_target_id),
                            None,
                            Some(message_ref),
                            1,
                            job_key.as_str(),
                        )
                        .await
                    {
                        warn!(
                            target: "ipc::projects::service",
                            "failed to log EXTRACT_XLIFF failure for conversion {conversion_id}: {job_error}"
                        );
                    }
                } else {
                    warn!(
                        target: "ipc::projects::service",
                        "conversion {conversion_id} failed but no file_target row for {src_lang}->{tgt_lang}; skipping status update"
                    );
                }
            }
            _ => {}
        }

        Ok(())
    }
}

impl ProjectService {
    async fn handle_staging_failure(db: &DbManager, project_id: Uuid, staging_dir: &PathBuf) {
        if let Err(error) = db
            .update_project_lifecycle_status(project_id, ProjectLifecycleStatus::Error)
            .await
        {
            error!(
                target: "ipc::projects::service",
                "failed to mark project {project_id} as ERROR after staging failure: {error}"
            );
        }

        if let Err(error) = tokio::fs::remove_dir_all(staging_dir).await {
            error!(
                target: "ipc::projects::service",
                "failed to cleanup staging directory {:?}: {error}",
                staging_dir
            );
        }
    }

    async fn resolve_conversion_languages(
        db: &DbManager,
        project_id: Uuid,
        conversion: &ProjectFileConversionRow,
    ) -> Result<(String, String), IpcError> {
        let (default_src, default_tgt) = db
            .project_language_defaults(project_id)
            .await
            .map_err(IpcError::from)?;

        let src_lang = Self::coalesce_language(
            &conversion.src_lang,
            default_src.as_deref(),
            DEFAULT_SOURCE_LANGUAGE,
        );
        let tgt_lang = Self::coalesce_language(
            &conversion.tgt_lang,
            default_tgt.as_deref(),
            DEFAULT_TARGET_LANGUAGE,
        );

        Ok((src_lang, tgt_lang))
    }

    fn coalesce_language(value: &str, fallback: Option<&str>, default: &str) -> String {
        let candidate = value.trim();
        if !candidate.is_empty() {
            return candidate.to_string();
        }

        if let Some(fallback_value) = fallback {
            let fallback_trimmed = fallback_value.trim();
            if !fallback_trimmed.is_empty() {
                return fallback_trimmed.to_string();
            }
        }

        default.to_string()
    }
}

#[derive(Debug, Deserialize)]
struct ValidationPayload {
    #[serde(default)]
    validator: Option<String>,
    #[serde(default, rename = "schemaPath")]
    schema_path: Option<String>,
    #[serde(default)]
    passed: Option<bool>,
    #[serde(default)]
    skipped: Option<bool>,
    #[serde(default)]
    message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::constants::MIGRATOR;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn new_manager() -> DbManager {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(":memory:")
            .await
            .expect("open in-memory db");
        MIGRATOR.run(&pool).await.expect("apply migrations");
        DbManager::from_pool(pool)
    }

    #[tokio::test]
    async fn seed_project_metadata_dual_writes_legacy_conversions() {
        let manager = new_manager().await;
        let project_id = Uuid::new_v4();
        let project = NewProject {
            id: project_id,
            name: "Seed Demo".into(),
            slug: "seed-demo".into(),
            project_type: crate::db::ProjectType::Translation,
            root_path: "/tmp/seed-demo".into(),
            status: ProjectStatus::Active,
            owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
            client_id: None,
            domain_id: None,
            lifecycle_status: ProjectLifecycleStatus::Creating,
            archived_at: None,
            default_src_lang: Some("en-US".into()),
            default_tgt_lang: Some("fr-FR".into()),
            metadata: None,
        };

        let file_specs = vec![
            (
                "demo.docx".to_string(),
                "/abs/demo.docx".to_string(),
                "docx".to_string(),
            ),
            (
                "glossary.tbx".to_string(),
                "/abs/glossary.tbx".to_string(),
                "tbx".to_string(),
            ),
        ];

        let seed_inputs: Vec<SeedProjectFileInput<'_>> = file_specs
            .iter()
            .map(|(name, path, ext)| SeedProjectFileInput {
                original_name: name.as_str(),
                original_path: path.as_str(),
                extension: ext.as_str(),
            })
            .collect();

        let language_pairs = vec![("en-US".to_string(), "fr-FR".to_string())];

        let seeded = ProjectService::seed_project_metadata(
            &manager,
            &project,
            &seed_inputs,
            &language_pairs,
        )
        .await
        .expect("seed project metadata");

        let doc_entry = seeded
            .files
            .iter()
            .find(|entry| entry.original_name == "demo.docx")
            .expect("docx entry seeded");
        let tbx_entry = seeded
            .files
            .iter()
            .find(|entry| entry.original_name == "glossary.tbx")
            .expect("tbx entry seeded");

        let pool = manager.pool().await;
        let doc_id = doc_entry.file_id.to_string();
        let doc_rows: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT src_lang, tgt_lang, status FROM project_file_conversions WHERE project_file_id = ?1",
        )
        .bind(&doc_id)
        .fetch_all(&pool)
        .await
        .expect("query docx conversions");

        assert_eq!(
            doc_rows.len(),
            1,
            "docx file should have one conversion row"
        );
        assert_eq!(doc_rows[0].0, "en-US");
        assert_eq!(doc_rows[0].1, "fr-FR");
        assert_eq!(doc_rows[0].2, "pending");

        let tbx_id = tbx_entry.file_id.to_string();
        let tbx_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM project_file_conversions WHERE project_file_id = ?1",
        )
        .bind(&tbx_id)
        .fetch_one(&pool)
        .await
        .expect("query tbx conversions count");

        assert_eq!(
            tbx_count, 0,
            "non-convertible TBX file should not get legacy conversion rows"
        );
    }

    // Note: Full integration tests would require database and filesystem setup
    // These are unit tests for the validation and coordination logic

    #[test]
    fn test_service_exists() {
        // Basic test to ensure the service compiles
        let _service = ProjectService;
    }

    #[test]
    fn coalesce_language_prefers_explicit_value() {
        let resolved = ProjectService::coalesce_language(" en-US ", Some("fr-FR"), "en-GB");
        assert_eq!(resolved, "en-US");
    }

    #[test]
    fn coalesce_language_falls_back_to_default() {
        let resolved = ProjectService::coalesce_language("", Some("  "), "en-GB");
        assert_eq!(resolved, "en-GB");
    }

    #[test]
    fn coalesce_language_uses_project_default() {
        let resolved = ProjectService::coalesce_language("", Some(" de-DE "), "en-GB");
        assert_eq!(resolved, "de-DE");
    }

    // Additional tests would require mock dependencies or integration test setup
    // Left as placeholder for future test implementation
}

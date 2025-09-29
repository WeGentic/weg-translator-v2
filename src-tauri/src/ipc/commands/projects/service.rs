//! Project management service layer
//!
//! This module contains the core business logic for project management operations.
//! It orchestrates validation, file operations, database operations, and artifact
//! management to provide high-level project management functionality.

use std::path::PathBuf;

use log::{error, info};
use uuid::Uuid;

use super::artifacts::{
    build_conversions_plan, convert_xliff_to_jliff, read_project_artifact, update_jliff_segment,
    JliffConversionResult, UpdateJliffSegmentResult,
};
use super::constants::{DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_XLIFF_VERSION};
use super::dto_mappers::{project_details_to_dto, project_file_to_dto, project_list_to_dto};
use super::file_operations::{
    cleanup_project_directory, create_project_directory, import_files_to_project,
    remove_multiple_artifacts,
};
use super::validation::{
    validate_conversion_status, validate_optional_language, validate_pagination_params,
    validate_project_files, validate_project_name, validate_project_type, validate_transunit_id,
};
use crate::db::{DbManager, NewProject, ProjectFileConversionRequest, ProjectStatus};
use crate::db::constants::{CONVERTIBLE_EXTENSIONS, SKIP_CONVERSION_EXTENSIONS};
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

impl ProjectService {
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
        let default_src_lang = validate_optional_language(request.default_src_lang)
            .or_else(|| Some(DEFAULT_SOURCE_LANGUAGE.into()));
        let default_tgt_lang = validate_optional_language(request.default_tgt_lang)
            .or_else(|| Some(DEFAULT_TARGET_LANGUAGE.into()));

        // Validate and process files
        let validated_files = validate_project_files(request.files).await?;

        // Generate project ID and create directory
        let project_id = Uuid::new_v4();
        let created_dir = create_project_directory(settings, &project_name, project_id).await?;

        // Import files into project directory
        let imported_files = match import_files_to_project(
            &created_dir.project_dir,
            project_id,
            &validated_files,
        )
        .await
        {
            Ok(files) => files,
            Err(error) => {
                // Clean up project directory on import failure
                cleanup_project_directory(&created_dir.project_dir).await;
                return Err(error);
            }
        };

        // Prepare project record for database
        let project_record = NewProject {
            id: project_id,
            name: project_name.clone(),
            slug: super::utils::build_project_slug(&project_name, project_id),
            project_type,
            root_path: created_dir.project_dir.display().to_string(),
            status: ProjectStatus::Active,
            default_src_lang,
            default_tgt_lang,
            metadata: None,
        };

        // Extract database records from imported files
        let file_records: Vec<_> = imported_files.iter().map(|f| f.db_record.clone()).collect();

        // Persist to database
        if let Err(db_error) = db
            .insert_project_with_files(&project_record, &file_records)
            .await
        {
            error!(
                target: "ipc::projects::service",
                "failed to persist project {:?}: {db_error}",
                project_id
            );
            // Clean up project directory on database failure
            cleanup_project_directory(&created_dir.project_dir).await;
            return Err(IpcError::from(db_error));
        }

        info!(
            target: "ipc::projects::service",
            "created project {project_id} with {count} file(s)",
            count = imported_files.len()
        );

        Ok(CreateProjectResponse {
            project_id: project_id.to_string(),
            slug: project_record.slug,
            folder: created_dir.project_dir.display().to_string(),
            file_count: imported_files.len(),
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
        let imported_files = import_files_to_project(&project_root, project_id, &validated_files).await?;

        // Extract database records
        let file_records: Vec<_> = imported_files.iter().map(|f| f.db_record.clone()).collect();

        // Persist to database
        let inserted_files = db.add_files_to_project(project_id, &file_records).await?;

        // Ensure conversion stubs exist for convertible formats
        if !inserted_files.is_empty() {
            let (default_src, default_tgt) = db.project_language_defaults(project_id).await?;
            let src_lang = default_src.unwrap_or_else(|| DEFAULT_SOURCE_LANGUAGE.to_string());
            let tgt_lang = default_tgt.unwrap_or_else(|| DEFAULT_TARGET_LANGUAGE.to_string());
            let conversion_request = ProjectFileConversionRequest::new(&src_lang, &tgt_lang, DEFAULT_XLIFF_VERSION);

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
                .chain(file_entry.conversions.iter().filter_map(|conv| conv.jliff_rel_path.as_deref()))
                .chain(file_entry.conversions.iter().filter_map(|conv| conv.tag_map_rel_path.as_deref()))
                .collect();

            // Remove all conversion artifacts
            remove_multiple_artifacts(&root_path, artifact_paths.into_iter(), "conversion artifact").await;
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
    pub async fn delete_project(
        db: &DbManager,
        project_id: Uuid,
    ) -> Result<u64, IpcError> {
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
        convert_xliff_to_jliff(db, project_id, conversion_id, xliff_abs_path, operator, schema_abs_path).await
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
    ) -> Result<(), IpcError> {
        use crate::db::ProjectFileConversionStatus as S;

        // Validate and parse status
        let validated_status = validate_conversion_status(&status)?;
        let parsed_status = match validated_status {
            "pending" => S::Pending,
            "running" => S::Running,
            "completed" => S::Completed,
            "failed" => S::Failed,
            _ => unreachable!(), // validate_conversion_status ensures this
        };

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
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Full integration tests would require database and filesystem setup
    // These are unit tests for the validation and coordination logic

    #[test]
    fn test_service_exists() {
        // Basic test to ensure the service compiles
        let _service = ProjectService;
    }

    // Additional tests would require mock dependencies or integration test setup
    // Left as placeholder for future test implementation
}

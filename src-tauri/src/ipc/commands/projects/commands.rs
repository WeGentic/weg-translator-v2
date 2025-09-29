//! Tauri command handlers for project management
//!
//! This module contains thin wrapper functions around the service layer
//! that serve as Tauri command handlers. These functions handle the IPC
//! layer concerns while delegating business logic to the service module.

use tauri::{AppHandle, State};
use uuid::Uuid;

use super::service::ProjectService;
use crate::db::DbManager;
use crate::ipc::dto::{
    AddFilesResponseDto, CreateProjectRequest, CreateProjectResponse, EnsureConversionsPlanDto,
    ProjectDetailsDto, ProjectListItemDto,
};
use crate::ipc::error::IpcResult;
use crate::settings::SettingsManager;

/// Creates a new project with the provided source files
///
/// This Tauri command handler validates the project request and delegates
/// to the service layer for the actual project creation logic.
///
/// # Arguments
/// * `_app` - Tauri application handle (unused but required by Tauri)
/// * `settings` - Settings manager state for app configuration
/// * `db` - Database manager state for persistence
/// * `req` - Project creation request from frontend
///
/// # Returns
/// Project creation response with ID, slug, and file count
///
/// # Frontend Usage
/// ```typescript
/// const response = await invoke('create_project_with_files', {
///   req: {
///     name: 'My Translation Project',
///     projectType: 'translation',
///     defaultSrcLang: 'en-US',
///     defaultTgtLang: 'fr-FR',
///     files: ['/path/to/document.docx', '/path/to/presentation.pptx']
///   }
/// });
/// ```
#[tauri::command]
pub async fn create_project_with_files(
    _app: AppHandle,
    settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    req: CreateProjectRequest,
) -> IpcResult<CreateProjectResponse> {
    ProjectService::create_project_with_files(&settings, &db, req)
        .await
        .map_err(Into::into)
}

/// Retrieves detailed information about a specific project
///
/// Returns comprehensive project details including all files and
/// their conversion records for the project management UI.
///
/// # Arguments
/// * `db` - Database manager state for data access
/// * `project_id` - UUID of the project to retrieve
///
/// # Returns
/// Complete project details with nested file and conversion data
///
/// # Frontend Usage
/// ```typescript
/// const details = await invoke('get_project_details', {
///   projectId: 'project-uuid-string'
/// });
/// ```
#[tauri::command]
pub async fn get_project_details(
    db: State<'_, DbManager>,
    project_id: Uuid,
) -> IpcResult<ProjectDetailsDto> {
    ProjectService::get_project_details(&db, project_id)
        .await
        .map_err(Into::into)
}

/// Adds additional files to an existing project
///
/// Validates and imports new files into the specified project,
/// updating the database with file metadata.
///
/// # Arguments
/// * `_app` - Tauri application handle (unused but required by Tauri)
/// * `_settings` - Settings manager state (unused in current implementation)
/// * `db` - Database manager state for persistence
/// * `project_id` - UUID of the target project
/// * `files` - Vector of file paths to add to the project
///
/// # Returns
/// Information about successfully added files
///
/// # Frontend Usage
/// ```typescript
/// const result = await invoke('add_files_to_project', {
///   projectId: 'project-uuid',
///   files: ['/path/to/new-file.docx']
/// });
/// ```
#[tauri::command]
pub async fn add_files_to_project(
    _app: AppHandle,
    _settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    project_id: Uuid,
    files: Vec<String>,
) -> IpcResult<AddFilesResponseDto> {
    ProjectService::add_files_to_project(&db, project_id, files)
        .await
        .map_err(Into::into)
}

/// Removes a specific file from a project
///
/// Deletes the file record from the database and cleans up associated
/// artifacts including the physical file and any conversion outputs.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `project_id` - UUID of the project containing the file
/// * `project_file_id` - UUID of the file to remove
///
/// # Returns
/// Number of database records removed (typically 1)
///
/// # Frontend Usage
/// ```typescript
/// const removedCount = await invoke('remove_project_file', {
///   projectId: 'project-uuid',
///   projectFileId: 'file-uuid'
/// });
/// ```
#[tauri::command]
pub async fn remove_project_file(
    db: State<'_, DbManager>,
    project_id: Uuid,
    project_file_id: Uuid,
) -> IpcResult<u64> {
    ProjectService::remove_project_file(&db, project_id, project_file_id)
        .await
        .map_err(Into::into)
}

/// Deletes an entire project and all associated data
///
/// Removes the project from the database and cleans up the project
/// directory and all contained files from the filesystem.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `project_id` - UUID of the project to delete
///
/// # Returns
/// Number of database records removed
///
/// # Frontend Usage
/// ```typescript
/// const deletedCount = await invoke('delete_project', {
///   projectId: 'project-uuid'
/// });
/// ```
#[tauri::command]
pub async fn delete_project(db: State<'_, DbManager>, project_id: Uuid) -> IpcResult<u64> {
    ProjectService::delete_project(&db, project_id)
        .await
        .map_err(Into::into)
}

/// Lists projects with pagination support
///
/// Retrieves a paginated list of projects with basic metadata
/// for display in the project dashboard.
///
/// # Arguments
/// * `db` - Database manager state for data access
/// * `limit` - Optional limit for number of results (default: 50, max: 200)
/// * `offset` - Optional offset for pagination (default: 0)
///
/// # Returns
/// Vector of project list items with basic metadata
///
/// # Frontend Usage
/// ```typescript
/// const projects = await invoke('list_projects', {
///   limit: 20,
///   offset: 0
/// });
/// ```
#[tauri::command]
pub async fn list_projects(
    db: State<'_, DbManager>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> IpcResult<Vec<ProjectListItemDto>> {
    ProjectService::list_projects(&db, limit, offset)
        .await
        .map_err(Into::into)
}

/// Builds a plan for ensuring all project files have XLIFF conversions
///
/// Analyzes the project to identify files that need XLIFF conversion
/// and generates a plan with all necessary conversion parameters.
///
/// # Arguments
/// * `db` - Database manager state for data access
/// * `project_id` - UUID of the project to analyze
///
/// # Returns
/// Conversion plan with tasks for files needing XLIFF generation
///
/// # Frontend Usage
/// ```typescript
/// const plan = await invoke('ensure_project_conversions_plan', {
///   projectId: 'project-uuid'
/// });
/// // Frontend can then execute the conversion tasks
/// ```
#[tauri::command]
pub async fn ensure_project_conversions_plan(
    db: State<'_, DbManager>,
    project_id: Uuid,
) -> IpcResult<EnsureConversionsPlanDto> {
    ProjectService::ensure_project_conversions_plan(&db, project_id)
        .await
        .map_err(Into::into)
}

/// Converts an XLIFF file to JLIFF format
///
/// Performs the conversion from XLIFF to the internal JLIFF format,
/// generating both the JLIFF document and associated tag mapping files.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `project_id` - UUID of the project
/// * `conversion_id` - UUID of the conversion record
/// * `xliff_abs_path` - Absolute path to the source XLIFF file
/// * `operator` - Optional operator name for metadata
/// * `schema_abs_path` - Optional path to JLIFF schema for validation
///
/// # Returns
/// Information about the generated JLIFF artifacts
///
/// # Frontend Usage
/// ```typescript
/// const result = await invoke('convert_xliff_to_jliff', {
///   projectId: 'project-uuid',
///   conversionId: 'conversion-uuid',
///   xliffAbsPath: '/path/to/file.xlf',
///   operator: 'Translation Team',
///   schemaAbsPath: null
/// });
/// ```
#[tauri::command]
pub async fn convert_xliff_to_jliff(
    db: State<'_, DbManager>,
    project_id: Uuid,
    conversion_id: Uuid,
    xliff_abs_path: String,
    operator: Option<String>,
    schema_abs_path: Option<String>,
) -> IpcResult<super::artifacts::JliffConversionResult> {
    ProjectService::convert_xliff_to_jliff(
        &db,
        project_id,
        conversion_id,
        xliff_abs_path,
        operator,
        schema_abs_path,
    )
    .await
    .map_err(Into::into)
}

/// Reads the contents of a project artifact file
///
/// Safely reads project artifacts by relative path with security
/// validation to prevent directory traversal attacks.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `project_id` - UUID of the project containing the artifact
/// * `rel_path` - Relative path to the artifact within the project
///
/// # Returns
/// Contents of the artifact file as a UTF-8 string
///
/// # Frontend Usage
/// ```typescript
/// const content = await invoke('read_project_artifact', {
///   projectId: 'project-uuid',
///   relPath: 'jliff/document.jliff'
/// });
/// ```
#[tauri::command]
pub async fn read_project_artifact(
    db: State<'_, DbManager>,
    project_id: Uuid,
    rel_path: String,
) -> IpcResult<String> {
    ProjectService::read_project_artifact(&db, project_id, rel_path)
        .await
        .map_err(Into::into)
}

/// Updates a translation segment in a JLIFF document
///
/// Modifies a specific translation unit in a JLIFF file with new
/// target text, using file locking for concurrency safety.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `project_id` - UUID of the project containing the JLIFF
/// * `jliff_rel_path` - Relative path to the JLIFF file
/// * `transunit_id` - ID of the translation unit to update
/// * `new_target` - New translation text for the segment
///
/// # Returns
/// Information about the update operation including count and timestamp
///
/// # Frontend Usage
/// ```typescript
/// const result = await invoke('update_jliff_segment', {
///   projectId: 'project-uuid',
///   jliffRelPath: 'jliff/document.jliff',
///   transunitId: 'segment-123',
///   newTarget: 'Updated translation text'
/// });
/// ```
#[tauri::command]
pub async fn update_jliff_segment(
    db: State<'_, DbManager>,
    project_id: Uuid,
    jliff_rel_path: String,
    transunit_id: String,
    new_target: String,
) -> IpcResult<super::artifacts::UpdateJliffSegmentResult> {
    ProjectService::update_jliff_segment(&db, project_id, jliff_rel_path, transunit_id, new_target)
        .await
        .map_err(Into::into)
}

/// Updates the status of a conversion operation
///
/// Records conversion progress, completion, or failure in the database
/// along with associated artifact paths and error information.
///
/// # Arguments
/// * `db` - Database manager state for operations
/// * `conversion_id` - UUID of the conversion to update
/// * `status` - New status ("pending", "running", "completed", "failed")
/// * `xliff_rel_path` - Optional relative path to XLIFF artifact
/// * `jliff_rel_path` - Optional relative path to JLIFF artifact
/// * `tag_map_rel_path` - Optional relative path to tag mapping artifact
/// * `error_message` - Optional error message for failed conversions
///
/// # Returns
/// Unit type on successful update
///
/// # Frontend Usage
/// ```typescript
/// await invoke('update_conversion_status', {
///   conversionId: 'conversion-uuid',
///   status: 'completed',
///   xliffRelPath: 'xliff/document.en-fr.xlf',
///   jliffRelPath: 'jliff/document.jliff',
///   tagMapRelPath: 'jliff/document.tagmap.json',
///   errorMessage: null
/// });
/// ```
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
    ProjectService::update_conversion_status(
        &db,
        conversion_id,
        status,
        xliff_rel_path,
        jliff_rel_path,
        tag_map_rel_path,
        error_message,
    )
    .await
    .map_err(Into::into)
}
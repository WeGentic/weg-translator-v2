//! Data Transfer Object (DTO) mapping functions
//!
//! This module handles conversion between internal database types and
//! the DTOs used for IPC communication with the frontend. It provides
//! a clean separation between internal data structures and API contracts.

use crate::db::{ProjectDetails, ProjectFileConversionRow, ProjectFileDetails, ProjectListItem};
use crate::ipc::dto::{
    ProjectDetailsDto, ProjectFileConversionDto, ProjectFileDto, ProjectFileWithConversionsDto,
    ProjectListItemDto,
};

/// Converts a database ProjectListItem to a DTO for API responses
///
/// This function maps internal project list data to the format expected
/// by the frontend, converting UUIDs to strings and enum values to their
/// string representations.
///
/// # Arguments
/// * `project` - The database project list item to convert
///
/// # Returns
/// ProjectListItemDto ready for JSON serialization
///
/// # DTO Fields
/// - `project_id`: UUID converted to string for JSON compatibility
/// - `project_type`: ProjectType enum converted to lowercase string
/// - `status`: ProjectStatus enum converted to lowercase string
/// - Other fields are passed through unchanged
pub fn project_list_item_to_dto(project: ProjectListItem) -> ProjectListItemDto {
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

/// Converts database ProjectDetails to a DTO for API responses
///
/// This function performs a comprehensive mapping of project details
/// including all associated files and their conversion records. It
/// recursively converts nested structures to their DTO equivalents.
///
/// # Arguments
/// * `details` - The database project details to convert
///
/// # Returns
/// ProjectDetailsDto with all nested structures converted
///
/// # Nested Conversions
/// This function orchestrates the conversion of:
/// - Project metadata (ID, name, languages, paths)
/// - File records via `project_file_to_dto`
/// - Conversion records via `project_file_conversion_to_dto`
pub fn project_details_to_dto(details: &ProjectDetails) -> ProjectDetailsDto {
    let files = details
        .files
        .iter()
        .map(|file_with_conversions| ProjectFileWithConversionsDto {
            file: project_file_to_dto(&file_with_conversions.file),
            conversions: file_with_conversions
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

/// Converts a database ProjectFileDetails to a DTO for API responses
///
/// Maps individual file metadata from the database format to the
/// frontend-expected format, handling UUID conversion and enum mapping.
///
/// # Arguments
/// * `file` - The database project file details to convert
///
/// # Returns
/// ProjectFileDto ready for JSON serialization
///
/// # Field Mappings
/// - `id`: UUID to string conversion
/// - `import_status`: ProjectFileImportStatus enum to string
/// - `size_bytes`: Optional i64 passed through (may be None for inaccessible files)
/// - Timestamps and paths passed through unchanged
pub fn project_file_to_dto(file: &ProjectFileDetails) -> ProjectFileDto {
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

/// Converts a database ProjectFileConversionRow to a DTO for API responses
///
/// Maps conversion record data including status, timestamps, file paths,
/// and error information from database format to API format.
///
/// # Arguments
/// * `row` - The database conversion row to convert
///
/// # Returns
/// ProjectFileConversionDto ready for JSON serialization
///
/// # Field Mappings
/// - `id`, `project_file_id`: UUIDs to strings
/// - `status`: ProjectFileConversionStatus enum to string
/// - `paragraph`, `embed`: Boolean flags passed through
/// - Path fields: Optional strings passed through (None for pending conversions)
/// - Timestamp fields: Optional strings passed through
/// - Error information: Optional error messages and failure timestamps
///
/// # Conversion Status Mapping
/// The status field maps from internal enum values:
/// - `Pending` → "pending"
/// - `Running` → "running"
/// - `Completed` → "completed"
/// - `Failed` → "failed"
pub fn project_file_conversion_to_dto(row: &ProjectFileConversionRow) -> ProjectFileConversionDto {
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

/// Converts a list of database ProjectListItems to DTOs
///
/// Convenience function for converting multiple project list items
/// at once, commonly used in list/pagination endpoints.
///
/// # Arguments
/// * `projects` - Vector of database project list items
///
/// # Returns
/// Vector of ProjectListItemDto objects ready for JSON serialization
pub fn project_list_to_dto(projects: Vec<ProjectListItem>) -> Vec<ProjectListItemDto> {
    projects.into_iter().map(project_list_item_to_dto).collect()
}

/// Extracts file IDs from project details for quick lookup
///
/// Utility function that creates a mapping from file UUID strings
/// to ProjectFileDetails for efficient lookup during conversion
/// planning operations.
///
/// # Arguments
/// * `details` - Project details containing files
///
/// # Returns
/// HashMap mapping file ID strings to ProjectFileDetails references
///
/// # Usage
/// This is typically used in conversion planning where we need to
/// look up file details by ID when processing conversion records.
pub fn create_file_id_map(
    details: &ProjectDetails,
) -> std::collections::HashMap<String, &ProjectFileDetails> {
    details
        .files
        .iter()
        .map(|file_with_conversions| {
            (
                file_with_conversions.file.id.to_string(),
                &file_with_conversions.file,
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        ProjectFileConversionStatus, ProjectFileImportStatus, ProjectStatus, ProjectType,
    };
    use uuid::Uuid;

    fn create_test_project_list_item() -> ProjectListItem {
        ProjectListItem {
            id: Uuid::new_v4(),
            name: "Test Project".to_string(),
            slug: "test-project-12345678".to_string(),
            project_type: ProjectType::Translation,
            root_path: "/path/to/project".to_string(),
            status: ProjectStatus::Active,
            activity_status: "active".to_string(),
            file_count: 5,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-02T00:00:00Z".to_string(),
        }
    }

    fn create_test_project_file() -> ProjectFileDetails {
        ProjectFileDetails {
            id: Uuid::new_v4(),
            original_name: "document.docx".to_string(),
            stored_rel_path: "document.docx".to_string(),
            ext: "docx".to_string(),
            size_bytes: Some(1024),
            import_status: ProjectFileImportStatus::Imported,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_project_list_item_to_dto() {
        let project = create_test_project_list_item();
        let project_id = project.id.to_string();

        let dto = project_list_item_to_dto(project);

        assert_eq!(dto.project_id, project_id);
        assert_eq!(dto.name, "Test Project");
        assert_eq!(dto.project_type, "translation");
        assert_eq!(dto.status, "active");
        assert_eq!(dto.file_count, 5);
    }

    #[test]
    fn test_project_file_to_dto() {
        let file = create_test_project_file();
        let file_id = file.id.to_string();

        let dto = project_file_to_dto(&file);

        assert_eq!(dto.id, file_id);
        assert_eq!(dto.original_name, "document.docx");
        assert_eq!(dto.ext, "docx");
        assert_eq!(dto.size_bytes, Some(1024));
        assert_eq!(dto.import_status, "imported");
    }

    #[test]
    fn test_project_file_conversion_to_dto() {
        let conversion = ProjectFileConversionRow {
            id: Uuid::new_v4(),
            project_file_id: Uuid::new_v4(),
            src_lang: "en-US".to_string(),
            tgt_lang: "fr-FR".to_string(),
            version: "2.0".to_string(),
            paragraph: true,
            embed: false,
            xliff_rel_path: Some("xliff/document.en-fr.xlf".to_string()),
            jliff_rel_path: None,
            tag_map_rel_path: None,
            status: ProjectFileConversionStatus::Completed,
            started_at: Some("2023-01-01T10:00:00Z".to_string()),
            completed_at: Some("2023-01-01T10:05:00Z".to_string()),
            failed_at: None,
            error_message: None,
            created_at: "2023-01-01T09:00:00Z".to_string(),
            updated_at: "2023-01-01T10:05:00Z".to_string(),
        };

        let dto = project_file_conversion_to_dto(&conversion);

        assert_eq!(dto.src_lang, "en-US");
        assert_eq!(dto.tgt_lang, "fr-FR");
        assert_eq!(dto.status, "completed");
        assert_eq!(dto.paragraph, true);
        assert_eq!(dto.embed, false);
        assert!(dto.xliff_rel_path.is_some());
        assert!(dto.jliff_rel_path.is_none());
    }

    #[test]
    fn test_project_list_to_dto() {
        let projects = vec![
            create_test_project_list_item(),
            create_test_project_list_item(),
        ];

        let dtos = project_list_to_dto(projects);

        assert_eq!(dtos.len(), 2);
        assert_eq!(dtos[0].name, "Test Project");
        assert_eq!(dtos[1].name, "Test Project");
    }
}

//! Project management module
//!
//! This module provides comprehensive project management functionality including:
//!
//! - **Project Creation**: Create new translation/RAG projects with file import
//! - **File Management**: Add, remove, and organize project files
//! - **Conversion Pipeline**: XLIFF generation and JLIFF conversion workflows
//! - **Artifact Management**: Safe access to project artifacts and documents
//! - **Translation Editing**: Update translation segments in JLIFF documents
//!
//! # Architecture
//!
//! The module is organized into several focused submodules:
//!
//! - [`commands`]: Tauri command handlers (thin IPC layer)
//! - [`service`]: Business logic coordination and orchestration
//! - [`validation`]: Input validation and sanitization
//! - [`file_operations`]: File system operations and directory management
//! - [`artifacts`]: XLIFF/JLIFF artifact operations and conversions
//! - [`dto_mappers`]: Data transfer object conversions
//! - [`utils`]: Utility functions for naming, slugs, and path operations
//! - [`constants`]: Configuration values and limits
//!
//! # Security
//!
//! The module implements several security measures:
//!
//! - **Path Validation**: All relative paths are validated to prevent directory traversal
//! - **File Extension Filtering**: Only approved file types can be imported
//! - **Project Isolation**: Files are sandboxed within project directories
//! - **Atomic Operations**: Database and file operations coordinated for consistency
//!
//! # Usage Example
//!
//! ```rust
//! use crate::ipc::commands::projects::commands::*;
//! use crate::ipc::dto::CreateProjectRequest;
//!
//! // Create a new translation project
//! let request = CreateProjectRequest {
//!     name: "Marketing Materials".to_string(),
//!     project_type: "translation".to_string(),
//!     default_src_lang: Some("en-US".to_string()),
//!     default_tgt_lang: Some("fr-FR".to_string()),
//!     files: vec!["/path/to/brochure.docx".to_string()],
//! };
//!
//! // The command handler coordinates validation, file import, and database persistence
//! let response = create_project_with_files(app, settings, db, request).await?;
//! ```
//!
//! # Frontend Integration
//!
//! The command handlers are registered with Tauri to provide IPC endpoints:
//!
//! ```typescript
//! // Frontend can invoke these commands directly
//! const projects = await invoke('list_projects', { limit: 20 });
//! const details = await invoke('get_project_details', { projectId: uuid });
//! await invoke('update_jliff_segment', {
//!   projectId: uuid,
//!   jliffRelPath: 'jliff/document.jliff',
//!   transunitId: 'segment-1',
//!   newTarget: 'Nouvelle traduction'
//! });
//! ```

// Private submodules with specific responsibilities
mod artifacts;
mod constants;
mod dto_mappers;
mod file_operations;
mod service;
mod utils;
mod validation;

// Public module containing Tauri command handlers
pub mod commands;

// Re-export command functions for Tauri registration
pub use commands::{
    add_files_to_project, convert_xliff_to_jliff, create_project_with_files, delete_project,
    ensure_project_conversions_plan, get_project_details, list_projects, read_project_artifact,
    remove_project_file, update_conversion_status, update_jliff_segment,
};

// Re-export key types that might be needed by other modules
pub use artifacts::{JliffConversionResult, UpdateJliffSegmentResult};

// Internal re-exports for backwards compatibility during migration
// These support the original projects.rs consumers during the transition
pub use artifacts::{
    read_project_artifact as read_project_artifact_impl,
    update_jliff_segment as update_jliff_segment_impl,
};

/// Module version information
///
/// This can be used for compatibility checking and debugging
pub const MODULE_VERSION: &str = "2.0.0";

/// Module description for documentation and tooling
pub const MODULE_DESCRIPTION: &str = "Refactored project management with improved separation of concerns";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_exports() {
        // Verify that key types are properly exported
        assert_eq!(MODULE_VERSION, "2.0.0");
        assert!(!MODULE_DESCRIPTION.is_empty());
    }

    #[test]
    fn test_constants_accessible() {
        // Verify that constants from submodules are accessible
        use constants::*;
        assert_eq!(PROJECT_NAME_MIN_LEN, 2);
        assert_eq!(PROJECT_NAME_MAX_LEN, 120);
        assert_eq!(DEFAULT_SOURCE_LANGUAGE, "en-US");
    }
}
//! Database module exposing the manager, domain types, and grouped operations.

pub(crate) mod builders;
pub mod constants;
pub mod error;
pub mod manager;
mod operations;
pub mod types;
pub mod utils;

pub use constants::SQLITE_DB_FILE;
#[allow(unused_imports)]
pub use error::{DbError, DbResult};
pub use manager::DbManager;
#[allow(unused_imports)]
pub use types::{
    NewProject, NewProjectFile, NewProjectFileConversion, NewTranslationRecord,
    PersistedTranslationOutput, ProjectDetails, ProjectFileConversionRequest,
    ProjectFileConversionRow, ProjectFileConversionStatus, ProjectFileDetails,
    ProjectFileImportStatus, ProjectFileWithConversions, ProjectListItem, ProjectStatus,
    ProjectType,
};

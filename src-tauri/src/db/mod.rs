//! Database module exposing the manager, domain types, and grouped operations.

pub(crate) mod builders;
pub mod config;
pub mod constants;
pub mod error;
pub mod manager;
mod operations;
pub mod types;
pub mod utils;

pub use config::DatabasePerformanceConfig;
pub use constants::SQLITE_DB_FILE;
#[allow(unused_imports)]
pub use error::{DbError, DbResult};
pub use manager::DbManager;
#[allow(unused_imports)]
pub use types::{
    Artifact, ArtifactKind, ArtifactStatus, Client, Domain, FileTarget, FileTargetBackfillSummary,
    FileTargetStatus, FilesystemArtifactBackfillSummary, Job, JobState, JobType, LanguagePair,
    NewProject, NewProjectFile, NewProjectFileConversion, NewTranslationRecord, Note,
    PersistedTranslationOutput, ProjectDetails, ProjectFileConversionRequest,
    ProjectFileConversionRow, ProjectFileConversionStatus, ProjectFileDetails,
    ProjectFileImportStatus, ProjectFileRole, ProjectFileStorageState, ProjectFileWithConversions,
    ProjectLifecycleStatus, ProjectListItem, ProjectStatus, ProjectType, User, Validation,
};

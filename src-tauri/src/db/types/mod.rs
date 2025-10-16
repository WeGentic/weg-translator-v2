//! Domain-specific types grouped by translation, project, and conversion concerns.

pub mod artifact;
pub mod conversion;
pub mod file_target;
pub mod job;
pub mod language_pair;
pub mod note;
pub mod project;
pub mod reference;
pub mod schema;
pub mod translation;
pub mod validation;

pub use artifact::{Artifact, ArtifactKind, ArtifactStatus};
pub use conversion::{
    NewProjectFileConversion, ProjectFileConversionRequest, ProjectFileConversionRow,
    ProjectFileConversionStatus,
};
pub use file_target::{FileTarget, FileTargetStatus};
pub use job::{Job, JobState, JobType};
pub use language_pair::LanguagePair;
pub use note::Note;
pub use project::{
    NewProject, NewProjectFile, ProjectDetails, ProjectFileDetails, ProjectFileImportStatus,
    ProjectFileRole, ProjectFileStorageState, ProjectFileWithConversions, ProjectLifecycleStatus,
    ProjectListItem, ProjectStatus, ProjectType,
};
pub use reference::{Client, Domain, User};
pub use translation::{NewTranslationRecord, PersistedTranslationOutput};
pub use validation::Validation;

#[allow(unused_imports)]
pub use schema::*;

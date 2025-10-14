//! Project domain types stored in the database.

use serde_json::Value;
use uuid::Uuid;

use super::conversion::ProjectFileConversionRow;

/// Differentiates between supported project categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectType {
    Translation,
    Rag,
}

impl ProjectType {
    /// Database representation for the project type.
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectType::Translation => "translation",
            ProjectType::Rag => "rag",
        }
    }

    /// Parses a project type from a database string.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "translation" => Some(Self::Translation),
            "rag" => Some(Self::Rag),
            _ => None,
        }
    }
}

/// Tracks whether a project is active or archived.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectStatus {
    Active,
    Archived,
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectStatus::Active => "active",
            ProjectStatus::Archived => "archived",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "active" => Some(Self::Active),
            "archived" => Some(Self::Archived),
            _ => None,
        }
    }
}

/// Import status for a file stored under a project.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileImportStatus {
    Imported,
    Failed,
}

impl ProjectFileImportStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileImportStatus::Imported => "imported",
            ProjectFileImportStatus::Failed => "failed",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "imported" => Some(Self::Imported),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectLifecycleStatus {
    Creating,
    Ready,
    InProgress,
    Completed,
    Error,
}

impl ProjectLifecycleStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectLifecycleStatus::Creating => "CREATING",
            ProjectLifecycleStatus::Ready => "READY",
            ProjectLifecycleStatus::InProgress => "IN_PROGRESS",
            ProjectLifecycleStatus::Completed => "COMPLETED",
            ProjectLifecycleStatus::Error => "ERROR",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileRole {
    Source,
    Reference,
    TranslationMemory,
    Termbase,
    Styleguide,
    Other,
}

impl ProjectFileRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileRole::Source => "source",
            ProjectFileRole::Reference => "reference",
            ProjectFileRole::TranslationMemory => "tm",
            ProjectFileRole::Termbase => "termbase",
            ProjectFileRole::Styleguide => "styleguide",
            ProjectFileRole::Other => "other",
        }
    }
}

impl Default for ProjectFileRole {
    fn default() -> Self {
        ProjectFileRole::Source
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileStorageState {
    Staged,
    Copied,
    Missing,
    Deleted,
}

impl ProjectFileStorageState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileStorageState::Staged => "STAGED",
            ProjectFileStorageState::Copied => "COPIED",
            ProjectFileStorageState::Missing => "MISSING",
            ProjectFileStorageState::Deleted => "DELETED",
        }
    }
}

impl Default for ProjectFileStorageState {
    fn default() -> Self {
        ProjectFileStorageState::Copied
    }
}

/// Metadata describing a project file stored in the database.
#[derive(Debug, Clone)]
pub struct ProjectFileDetails {
    pub id: Uuid,
    pub original_name: String,
    pub stored_rel_path: String,
    pub ext: String,
    pub size_bytes: Option<i64>,
    pub import_status: ProjectFileImportStatus,
    pub created_at: String,
    pub updated_at: String,
    pub hash_sha256: Option<String>,
}

/// Aggregates a file with its associated conversions.
#[derive(Debug, Clone)]
pub struct ProjectFileWithConversions {
    pub file: ProjectFileDetails,
    pub conversions: Vec<ProjectFileConversionRow>,
}

/// A hydrated project row including linked files and conversions.
#[derive(Debug, Clone)]
pub struct ProjectDetails {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub default_src_lang: Option<String>,
    pub default_tgt_lang: Option<String>,
    pub root_path: String,
    pub files: Vec<ProjectFileWithConversions>,
}

/// New project payload persisted when creating a project.
#[derive(Debug, Clone)]
pub struct NewProject {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub project_type: ProjectType,
    pub root_path: String,
    pub status: ProjectStatus,
    pub owner_user_id: String,
    pub client_id: Option<String>,
    pub domain_id: Option<String>,
    pub lifecycle_status: ProjectLifecycleStatus,
    pub archived_at: Option<String>,
    pub default_src_lang: Option<String>,
    pub default_tgt_lang: Option<String>,
    pub metadata: Option<Value>,
}

/// New record for a file added to a project.
#[derive(Debug, Clone)]
pub struct NewProjectFile {
    pub id: Uuid,
    pub project_id: Uuid,
    pub original_name: String,
    pub original_path: String,
    pub stored_rel_path: String,
    pub ext: String,
    pub size_bytes: Option<i64>,
    pub checksum_sha256: Option<String>,
    pub import_status: ProjectFileImportStatus,
    pub role: ProjectFileRole,
    pub storage_state: ProjectFileStorageState,
    pub mime_type: Option<String>,
    pub hash_sha256: Option<String>,
    pub importer: Option<String>,
}

/// Compact representation used in project list queries.
#[derive(Debug, Clone)]
pub struct ProjectListItem {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub project_type: ProjectType,
    pub root_path: String,
    pub status: ProjectStatus,
    pub created_at: String,
    pub updated_at: String,
    pub file_count: i64,
    pub activity_status: String,
}

/// Summary of owner backfill execution.
#[derive(Debug, Clone, Copy)]
pub struct OwnerBackfillSummary {
    pub ensured_user: bool,
    pub updated_projects: u64,
}

/// Summary of language pair backfill execution.
#[derive(Debug, Clone, Copy)]
pub struct LanguagePairBackfillSummary {
    pub inserted_pairs: u64,
}

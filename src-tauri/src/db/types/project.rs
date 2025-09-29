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

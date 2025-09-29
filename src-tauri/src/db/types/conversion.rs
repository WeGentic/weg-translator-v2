//! Types that describe project file conversions and related requests.

use uuid::Uuid;

/// Status for a conversion job associated with a project file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileConversionStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl ProjectFileConversionStatus {
    /// Returns the canonical database representation for the status.
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileConversionStatus::Pending => "pending",
            ProjectFileConversionStatus::Running => "running",
            ProjectFileConversionStatus::Completed => "completed",
            ProjectFileConversionStatus::Failed => "failed",
        }
    }

    /// Converts a raw database value into the strongly typed status.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(Self::Pending),
            "running" => Some(Self::Running),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

/// Represents a conversion row that should be inserted into the database.
#[derive(Debug, Clone)]
pub struct NewProjectFileConversion {
    pub id: Uuid,
    pub project_file_id: Uuid,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
    pub xliff_rel_path: Option<String>,
    pub jliff_rel_path: Option<String>,
    pub tag_map_rel_path: Option<String>,
    pub status: ProjectFileConversionStatus,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub failed_at: Option<String>,
    pub error_message: Option<String>,
}

/// User-requested conversion options that we may reuse when looking up existing conversions.
#[derive(Debug, Clone)]
pub struct ProjectFileConversionRequest {
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
}

impl ProjectFileConversionRequest {
    /// Creates a request with defaults that enable paragraph segmentation and embedding support.
    pub fn new<S1, S2, S3>(src_lang: S1, tgt_lang: S2, version: S3) -> Self
    where
        S1: Into<String>,
        S2: Into<String>,
        S3: Into<String>,
    {
        Self {
            src_lang: src_lang.into(),
            tgt_lang: tgt_lang.into(),
            version: version.into(),
            paragraph: true,
            embed: true,
        }
    }
}

/// Fully hydrated conversion row returned from database queries.
#[derive(Debug, Clone)]
pub struct ProjectFileConversionRow {
    pub id: Uuid,
    pub project_file_id: Uuid,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
    pub xliff_rel_path: Option<String>,
    pub jliff_rel_path: Option<String>,
    pub tag_map_rel_path: Option<String>,
    pub status: ProjectFileConversionStatus,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub failed_at: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

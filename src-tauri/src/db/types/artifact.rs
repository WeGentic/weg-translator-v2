#![allow(dead_code)]

//! Artifact tracking types covering generated assets and metadata.

use uuid::Uuid;

/// Describes the artifact flavor stored on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactKind {
    Xliff,
    Jliff,
    QaReport,
    Preview,
}

impl ArtifactKind {
    /// Returns the canonical database representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            ArtifactKind::Xliff => "xliff",
            ArtifactKind::Jliff => "jliff",
            ArtifactKind::QaReport => "qa_report",
            ArtifactKind::Preview => "preview",
        }
    }

    /// Parses a database value into the strongly typed kind.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "xliff" => Some(Self::Xliff),
            "jliff" => Some(Self::Jliff),
            "qa_report" => Some(Self::QaReport),
            "preview" => Some(Self::Preview),
            _ => None,
        }
    }
}

/// Processing status for a tracked artifact.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactStatus {
    Generated,
    Failed,
}

impl ArtifactStatus {
    /// Returns the persisted text form for the status.
    pub fn as_str(&self) -> &'static str {
        match self {
            ArtifactStatus::Generated => "GENERATED",
            ArtifactStatus::Failed => "FAILED",
        }
    }

    /// Parses a stored status back into the strongly typed variant.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "GENERATED" => Some(Self::Generated),
            "FAILED" => Some(Self::Failed),
            _ => None,
        }
    }
}

/// Artifact record that ties generated assets to file targets.
#[derive(Debug, Clone)]
pub struct Artifact {
    pub artifact_id: Uuid,
    pub file_target_id: Uuid,
    pub kind: ArtifactKind,
    pub rel_path: String,
    pub size_bytes: Option<i64>,
    pub checksum: Option<String>,
    pub tool: Option<String>,
    pub status: ArtifactStatus,
    pub created_at: String,
    pub updated_at: String,
}

#![allow(dead_code)]
//! File target types that connect project files with language pairs.

use uuid::Uuid;

/// Processing status for a file target row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileTargetStatus {
    Pending,
    Extracted,
    Failed,
}

impl FileTargetStatus {
    /// Returns the canonical database representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            FileTargetStatus::Pending => "PENDING",
            FileTargetStatus::Extracted => "EXTRACTED",
            FileTargetStatus::Failed => "FAILED",
        }
    }

    /// Parses a database string into a strongly typed status.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "PENDING" => Some(Self::Pending),
            "EXTRACTED" => Some(Self::Extracted),
            "FAILED" => Some(Self::Failed),
            _ => None,
        }
    }
}

/// Associates a project file with a language pair for downstream processing.
#[derive(Debug, Clone)]
pub struct FileTarget {
    pub file_target_id: Uuid,
    pub file_id: Uuid,
    pub pair_id: Uuid,
    pub status: FileTargetStatus,
    pub created_at: String,
    pub updated_at: String,
}

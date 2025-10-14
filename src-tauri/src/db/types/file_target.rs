#![allow(dead_code)]
//! File target types that bridge project files with language pairs.

use uuid::Uuid;

use super::language_pair::LanguagePair;

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

/// Result of bridging legacy conversions into the new file-target model.
#[derive(Debug, Clone)]
pub struct FileTargetBridgeOutcome {
    pub language_pair: LanguagePair,
    pub file_target: FileTarget,
    pub created_language_pair: bool,
    pub created_file_target: bool,
    pub updated_status: bool,
    pub xliff_artifact_id: Option<Uuid>,
    pub jliff_artifact_id: Option<Uuid>,
}

/// Aggregate summary capturing the outcome of a legacy backfill run.
#[derive(Debug, Default, Clone)]
pub struct FileTargetBackfillSummary {
    pub scanned_projects: u64,
    pub bridged_conversions: u64,
    pub newly_created_language_pairs: u64,
    pub newly_created_file_targets: u64,
    pub updated_statuses: u64,
    pub xliff_artifacts_upserted: u64,
    pub jliff_artifacts_upserted: u64,
}

/// Summary produced when indexing artifacts directly from the filesystem.
#[derive(Debug, Default, Clone)]
pub struct FilesystemArtifactBackfillSummary {
    pub projects_scanned: u64,
    pub xliff_registered: u64,
    pub jliff_registered: u64,
    pub already_indexed: u64,
    pub skipped_unknown_language: u64,
    pub skipped_invalid_name: u64,
    pub checksum_failures: u64,
}

#![allow(dead_code)]

//! Job orchestration types that power the import and conversion pipeline.

use uuid::Uuid;

/// Supported background job categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobType {
    CopyFile,
    ExtractXliff,
    ConvertJliff,
    Validate,
}

impl JobType {
    /// Returns the canonical database representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            JobType::CopyFile => "COPY_FILE",
            JobType::ExtractXliff => "EXTRACT_XLIFF",
            JobType::ConvertJliff => "CONVERT_JLIFF",
            JobType::Validate => "VALIDATE",
        }
    }

    /// Parses a stored job type into the strongly typed variant.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "COPY_FILE" => Some(Self::CopyFile),
            "EXTRACT_XLIFF" => Some(Self::ExtractXliff),
            "CONVERT_JLIFF" => Some(Self::ConvertJliff),
            "VALIDATE" => Some(Self::Validate),
            _ => None,
        }
    }
}

/// State machine for background jobs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobState {
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl JobState {
    /// Returns the canonical database representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            JobState::Pending => "PENDING",
            JobState::Running => "RUNNING",
            JobState::Succeeded => "SUCCEEDED",
            JobState::Failed => "FAILED",
            JobState::Cancelled => "CANCELLED",
        }
    }

    /// Parses a stored job state into the strongly typed variant.
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "PENDING" => Some(Self::Pending),
            "RUNNING" => Some(Self::Running),
            "SUCCEEDED" => Some(Self::Succeeded),
            "FAILED" => Some(Self::Failed),
            "CANCELLED" => Some(Self::Cancelled),
            _ => None,
        }
    }
}

/// Job record tracked in the database import pipeline.
#[derive(Debug, Clone)]
pub struct Job {
    pub job_id: Uuid,
    pub project_id: Uuid,
    pub job_type: JobType,
    pub job_key: String,
    pub file_target_id: Option<Uuid>,
    pub artifact_id: Option<Uuid>,
    pub state: JobState,
    pub attempts: i64,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
}

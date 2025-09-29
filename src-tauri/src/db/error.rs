//! Core database error types and shared result alias.

use thiserror::Error;
use uuid::Uuid;

/// Convenient result alias that propagates [`DbError`] instances.
pub type DbResult<T> = Result<T, DbError>;

/// Errors surfaced by the database manager and related operations.
#[derive(Debug, Error)]
pub enum DbError {
    #[error("failed to resolve database path: {0}")]
    ResolvePath(#[from] tauri::Error),
    #[error("failed to prepare database directory: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to (de)serialize JSON payload: {0}")]
    Json(#[from] serde_json::Error),
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("translation job not found: {0}")]
    NotFound(Uuid),
    #[error("invalid translation stage '{0}' in storage")]
    InvalidStage(String),
    #[error("invalid job identifier stored in database: {0}")]
    InvalidUuid(String),
    #[error("duplicate translation job identifier: {0}")]
    DuplicateJob(Uuid),
    #[error("invalid project identifier stored in database: {0}")]
    InvalidProjectId(String),
    #[error("invalid project type '{0}' in storage")]
    InvalidProjectType(String),
    #[error("invalid project status '{0}' in storage")]
    InvalidProjectStatus(String),
    #[error("invalid project file status '{0}' in storage")]
    InvalidProjectFileStatus(String),
    #[error("invalid project file conversion status '{0}' in storage")]
    InvalidProjectFileConversionStatus(String),
    #[error("project not found: {0}")]
    ProjectNotFound(Uuid),
    #[error("project file conversion not found: {0}")]
    ProjectFileConversionNotFound(Uuid),
}

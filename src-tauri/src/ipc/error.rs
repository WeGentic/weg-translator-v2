use anyhow::anyhow;
use tauri::ipc::InvokeError;
use thiserror::Error;

use crate::db::DbError;

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    Internal(String),
}

pub type IpcResult<T> = Result<T, InvokeError>;

impl From<IpcError> for InvokeError {
    fn from(error: IpcError) -> Self {
        InvokeError::from_anyhow(anyhow!(error))
    }
}

impl From<DbError> for IpcError {
    fn from(error: DbError) -> Self {
        match error {
            DbError::NotFound(id) => {
                IpcError::Validation(format!("Translation job {id} was not found."))
            }
            DbError::DuplicateJob(_) => IpcError::Validation(
                "A translation job with the same identifier already exists.".into(),
            ),
            DbError::ResolvePath(_) | DbError::Io(_) => IpcError::Internal(
                "Unable to open the translation database. Check disk permissions and retry.".into(),
            ),
            DbError::Json(_) | DbError::InvalidStage(_) | DbError::InvalidUuid(_) => {
                IpcError::Internal(
                    "Stored translation data is invalid. Try clearing history and retry.".into(),
                )
            }
            DbError::InvalidProjectId(_)
            | DbError::InvalidProjectType(_)
            | DbError::InvalidProjectStatus(_)
            | DbError::InvalidProjectFileStatus(_)
            | DbError::InvalidProjectFileConversionStatus(_)
            | DbError::InvalidFileTargetStatus(_)
            | DbError::InvalidArtifactKind(_)
            | DbError::InvalidArtifactStatus(_)
            | DbError::InvalidJobType(_)
            | DbError::InvalidJobState(_) => {
                IpcError::Internal("Stored project data is invalid. Refresh and retry.".into())
            }
            DbError::ProjectNotFound(id) => {
                IpcError::Validation(format!("Project {id} was not found."))
            }
            DbError::ProjectFileConversionNotFound(id) => IpcError::Validation(format!(
                "Conversion {id} was not found for the requested project file.",
            )),
            DbError::InvalidSubdirectory(_) => IpcError::Validation(
                "Unable to derive a safe directory name for the requested operation.".into(),
            ),
            DbError::Sqlx(ref db_error) => {
                log::error!(
                    target: "ipc::error",
                    "sqlx error surfaced to IPC: {}",
                    db_error
                );
                IpcError::Internal("Database operation failed unexpectedly. Please retry.".into())
            }
        }
    }
}

impl From<DbError> for InvokeError {
    fn from(error: DbError) -> Self {
        IpcError::from(error).into()
    }
}

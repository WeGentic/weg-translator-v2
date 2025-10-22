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

fn map_constraint_message(raw: &str) -> String {
    let lower = raw.to_ascii_lowercase();

    if lower.contains("project_language_pairs") {
        "Each project language pair must be unique.".into()
    } else if lower.contains("project_subjects") {
        "Each project subject can only be added once.".into()
    } else if lower.contains("project_file_conversions") {
        "A conversion for this language pair and version already exists for the file.".into()
    } else if lower.contains("file language pair must match existing project language pair") {
        "File language pairs must match the project's language pairs.".into()
    } else if lower.contains("foreign key constraint failed") {
        "This action violates a foreign key constraint. Refresh and ensure all related records exist.".into()
    } else {
        raw.to_string()
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
            DbError::ConstraintViolation(message) => {
                IpcError::Validation(map_constraint_message(&message))
            }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_project_language_pair_constraint() {
        let error = DbError::ConstraintViolation(
            "UNIQUE constraint failed: project_language_pairs.project_uuid, project_language_pairs.source_lang, project_language_pairs.target_lang"
                .into(),
        );
        match IpcError::from(error) {
            IpcError::Validation(message) => {
                assert_eq!(message, "Each project language pair must be unique.",);
            }
            other => panic!("expected validation error, got {other:?}"),
        }
    }

    #[test]
    fn preserves_non_matching_constraint_message() {
        let raw = "file language pair must match existing project language pair";
        let error = DbError::ConstraintViolation(raw.into());
        match IpcError::from(error) {
            IpcError::Validation(message) => assert_eq!(
                message,
                "File language pairs must match the project's language pairs."
            ),
            other => panic!("expected validation error, got {other:?}"),
        }
    }
}

impl From<DbError> for InvokeError {
    fn from(error: DbError) -> Self {
        IpcError::from(error).into()
    }
}

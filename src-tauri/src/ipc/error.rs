use anyhow::anyhow;
use tauri::ipc::InvokeError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("invalid request: {0}")]
    Validation(String),
    #[error("internal error: {0}")]
    Internal(String),
}

pub type IpcResult<T> = Result<T, InvokeError>;

impl From<IpcError> for InvokeError {
    fn from(error: IpcError) -> Self {
        InvokeError::from_anyhow(anyhow!(error))
    }
}

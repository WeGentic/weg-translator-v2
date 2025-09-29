//! Translation-related data transfer types persisted by the database layer.

use crate::ipc::dto::TranslationRequest;
use uuid::Uuid;

/// Represents a translation job that has not yet been persisted.
#[derive(Debug, Clone)]
pub struct NewTranslationRecord {
    pub job_id: Uuid,
    pub request: TranslationRequest,
}

/// Output payload stored once a translation job finishes.
#[derive(Debug, Clone)]
pub struct PersistedTranslationOutput {
    pub job_id: Uuid,
    pub output_text: String,
    pub model_name: Option<String>,
    pub input_token_count: Option<i64>,
    pub output_token_count: Option<i64>,
    pub total_token_count: Option<i64>,
    pub duration_ms: Option<i64>,
}

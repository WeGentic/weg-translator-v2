//! Types describing validation records for artifacts.

use serde_json::Value;
use uuid::Uuid;

/// Validation record persisted for an artifact.
#[derive(Debug, Clone)]
pub struct Validation {
    pub validation_id: Uuid,
    pub artifact_id: Uuid,
    pub validator: String,
    pub passed: bool,
    pub result_json: Option<Value>,
    pub created_at: String,
}

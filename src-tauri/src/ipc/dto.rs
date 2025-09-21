use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationRequest {
    pub source_language: String,
    pub target_language: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobAccepted {
    pub job_id: Uuid,
    pub queued: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub project_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_src_lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_tgt_lang: Option<String>,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResponse {
    pub project_id: String,
    pub slug: String,
    pub folder: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListItemDto {
    pub project_id: String,
    pub name: String,
    pub slug: String,
    pub project_type: String,
    pub status: String,
    pub file_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStage {
    Received,
    Preparing,
    Translating,
    Completed,
    Failed,
}

impl TranslationStage {
    pub fn as_db_value(&self) -> &'static str {
        match self {
            TranslationStage::Received => "received",
            TranslationStage::Preparing => "preparing",
            TranslationStage::Translating => "translating",
            TranslationStage::Completed => "completed",
            TranslationStage::Failed => "failed",
        }
    }

    pub fn from_db_value(value: &str) -> Option<Self> {
        match value {
            "received" => Some(Self::Received),
            "preparing" => Some(Self::Preparing),
            "translating" => Some(Self::Translating),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationProgressPayload {
    pub job_id: Uuid,
    pub progress: f32,
    pub stage: TranslationStage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationCompletedPayload {
    pub job_id: Uuid,
    pub output_text: String,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationFailedPayload {
    pub job_id: Uuid,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealthReport {
    pub app_version: String,
    pub tauri_version: String,
    pub build_profile: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTranslationJob {
    pub job_id: Uuid,
    pub source_language: String,
    pub target_language: String,
    pub input_text: String,
    pub status: String,
    pub stage: TranslationStage,
    pub progress: f32,
    pub queued_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationOutputSnapshot {
    pub output_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_token_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_token_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_token_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationHistoryRecord {
    pub job: StoredTranslationJob,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<TranslationOutputSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsDto {
    pub app_folder: String,
    pub app_folder_exists: bool,
    pub database_path: String,
    pub database_exists: bool,
    pub projects_path: String,
    pub projects_path_exists: bool,
    pub settings_file: String,
    pub settings_file_exists: bool,
    pub default_app_folder: String,
    pub is_using_default_location: bool,
}

// ===== Projects: Details & Conversions DTOs =====

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileDto {
    pub id: String,
    pub original_name: String,
    pub stored_rel_path: String,
    pub ext: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    pub import_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileConversionDto {
    pub id: String,
    pub project_file_id: String,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xliff_rel_path: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileWithConversionsDto {
    pub file: ProjectFileDto,
    pub conversions: Vec<ProjectFileConversionDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetailsDto {
    pub id: String,
    pub name: String,
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_src_lang: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_tgt_lang: Option<String>,
    pub root_path: String,
    pub files: Vec<ProjectFileWithConversionsDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddFilesResponseDto {
    pub inserted: Vec<ProjectFileDto>,
    pub inserted_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureConversionsTaskDto {
    pub conversion_id: String,
    pub project_file_id: String,
    pub input_abs_path: String,
    pub output_abs_path: String,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureConversionsPlanDto {
    pub project_id: String,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub tasks: Vec<EnsureConversionsTaskDto>,
}

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
    pub activity_status: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectsChangedKind {
    Created,
    Updated,
    Deleted,
    FilesChanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionOverrideDto {
    pub permission: String,
    pub is_allowed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
    pub user_uuid: String,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    pub roles: Vec<String>,
    pub permission_overrides: Vec<PermissionOverrideDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_uuid: Option<String>,
    pub username: String,
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub permission_overrides: Vec<PermissionOverrideDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserPayload {
    pub user_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roles: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permission_overrides: Option<Vec<PermissionOverrideDto>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientDto {
    pub client_uuid: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vat_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClientPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_uuid: Option<String>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vat_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClientPayload {
    pub client_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vat_number: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectLanguagePairDto {
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLanguagePairDto {
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_uuid: Option<String>,
    pub project_name: String,
    #[serde(default = "default_project_status")]
    pub project_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_uuid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_uuid: Option<String>,
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default)]
    pub subjects: Vec<String>,
    pub language_pairs: Vec<ProjectLanguagePairDto>,
}

fn default_project_status() -> String {
    "active".to_string()
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectAssetRoleDto {
    Processable,
    Reference,
    Instructions,
    Image,
    Ocr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssetDescriptorDto {
    pub draft_id: String,
    pub name: String,
    pub extension: String,
    pub role: ProjectAssetRoleDto,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssetResultDto {
    pub draft_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_uuid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stored_rel_path: Option<String>,
    pub role: ProjectAssetRoleDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionTaskDto {
    pub draft_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_uuid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artifact_uuid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_type: Option<String>,
    pub source_lang: String,
    pub target_lang: String,
    pub source_path: String,
    pub xliff_rel_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub xliff_abs_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paragraph: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub embed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionPlanDto {
    pub project_uuid: String,
    #[serde(default)]
    pub tasks: Vec<ConversionTaskDto>,
    #[serde(default)]
    pub integrity_alerts: Vec<FileIntegrityAlertDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileIntegrityAlertDto {
    pub file_uuid: String,
    pub file_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureConversionPlanPayload {
    pub project_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_uuids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConversionStatusPayload {
    pub artifact_uuid: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub xliff_rel_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub xliff_abs_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jliff_rel_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag_map_rel_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validator: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertXliffToJliffPayload {
    pub project_uuid: String,
    pub conversion_id: String,
    pub xliff_abs_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_abs_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JliffConversionResultDto {
    pub file_id: String,
    pub jliff_abs_path: String,
    pub jliff_rel_path: String,
    pub tag_map_abs_path: String,
    pub tag_map_rel_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectWithAssetsPayload {
    pub project_name: String,
    pub project_folder_name: String,
    #[serde(default = "default_project_status")]
    pub project_status: String,
    pub user_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_uuid: Option<String>,
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default)]
    pub subjects: Vec<String>,
    #[serde(default)]
    pub language_pairs: Vec<ProjectLanguagePairDto>,
    #[serde(default)]
    pub assets: Vec<ProjectAssetDescriptorDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectWithAssetsResponseDto {
    pub project: ProjectBundleV2Dto,
    pub project_dir: String,
    #[serde(default)]
    pub assets: Vec<ProjectAssetResultDto>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversion_plan: Option<ConversionPlanDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectPayload {
    pub project_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_uuid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_uuid: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subjects: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language_pairs: Option<Vec<ProjectLanguagePairDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecordV2Dto {
    pub project_uuid: String,
    pub project_name: String,
    pub creation_date: String,
    pub update_date: String,
    pub project_status: String,
    pub user_uuid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subjects: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfoV2Dto {
    pub file_uuid: String,
    pub ext: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileLinkDto {
    pub project_uuid: String,
    pub file_uuid: String,
    pub filename: String,
    pub stored_at: String,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactV2Dto {
    pub artifact_uuid: String,
    pub project_uuid: String,
    pub file_uuid: String,
    pub artifact_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobV2Dto {
    pub artifact_uuid: String,
    pub job_type: String,
    pub project_uuid: String,
    pub job_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileBundleV2Dto {
    pub file: ProjectFileLinkDto,
    pub info: FileInfoV2Dto,
    pub language_pairs: Vec<FileLanguagePairDto>,
    pub artifacts: Vec<ArtifactV2Dto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBundleV2Dto {
    pub project: ProjectRecordV2Dto,
    pub subjects: Vec<String>,
    pub language_pairs: Vec<ProjectLanguagePairDto>,
    pub files: Vec<ProjectFileBundleV2Dto>,
    pub jobs: Vec<JobV2Dto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileTotalsDto {
    pub total: i64,
    pub processable: i64,
    pub reference: i64,
    pub instructions: i64,
    pub ocr: i64,
    pub image: i64,
    pub other: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConversionStatsDto {
    pub total: i64,
    pub completed: i64,
    pub failed: i64,
    pub pending: i64,
    pub running: i64,
    pub other: i64,
    pub segments: i64,
    pub tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectJobStatsDto {
    pub total: i64,
    pub completed: i64,
    pub failed: i64,
    pub pending: i64,
    pub running: i64,
    pub other: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectProgressStatsDto {
    pub processable_files: i64,
    pub files_ready: i64,
    pub files_with_errors: i64,
    pub percent_complete: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWarningStatsDto {
    pub total: i64,
    pub failed_artifacts: i64,
    pub failed_jobs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStatisticsDto {
    pub totals: ProjectFileTotalsDto,
    pub conversions: ProjectConversionStatsDto,
    pub jobs: ProjectJobStatsDto,
    pub progress: ProjectProgressStatsDto,
    pub warnings: ProjectWarningStatsDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachProjectFilePayload {
    pub project_uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_uuid: Option<String>,
    pub filename: String,
    pub stored_at: String,
    pub r#type: String,
    pub ext: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub language_pairs: Vec<FileLanguagePairDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertArtifactPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artifact_uuid: Option<String>,
    pub project_uuid: String,
    pub file_uuid: String,
    pub artifact_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateArtifactStatusPayload {
    pub artifact_uuid: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertJobPayload {
    pub artifact_uuid: String,
    pub job_type: String,
    pub project_uuid: String,
    pub job_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobStatusPayload {
    pub artifact_uuid: String,
    pub job_type: String,
    pub job_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsChangedPayload {
    pub kind: ProjectsChangedKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealthReport {
    pub app_version: String,
    pub tauri_version: String,
    pub build_profile: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineJobSummary {
    pub job_id: String,
    pub project_id: String,
    pub job_type: String,
    pub state: String,
    pub attempts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_target_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<String>,
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
    pub auto_convert_on_open: bool,
    pub theme: String,
    pub ui_language: String,
    pub default_source_language: String,
    pub default_target_language: String,
    pub default_xliff_version: String,
    pub show_notifications: bool,
    pub enable_sound_notifications: bool,
    pub max_parallel_conversions: u32,
    pub database_journal_mode: String,
    pub database_synchronous: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jliff_rel_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_map_rel_path: Option<String>,
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

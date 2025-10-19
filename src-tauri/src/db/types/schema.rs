//! Canonical data structures for the refactored SQLite schema.
//!
//! These types intentionally mirror the column layout of the new database
//! tables so that higher layers can rely on strong typing when composing
//! queries and assembling aggregates.

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, types::Json};
use uuid::Uuid;

/// Row representation of the `users` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserRecord {
    pub user_uuid: Uuid,
    pub username: String,
    pub email: String,
    pub phone: Option<String>,
    pub address: Option<String>,
}

/// Row representation of the `user_roles` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserRoleRecord {
    pub user_uuid: Uuid,
    pub role: String,
}

/// Row representation of the `user_permission_overrides` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserPermissionOverrideRecord {
    pub user_uuid: Uuid,
    pub permission: String,
    pub is_allowed: bool,
}

/// Row representation of the `clients` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ClientRecord {
    pub client_uuid: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub vat_number: Option<String>,
    pub note: Option<String>,
}

/// Row representation of the `projects` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ProjectRecord {
    pub project_uuid: Uuid,
    pub project_name: String,
    pub creation_date: String,
    pub update_date: String,
    pub project_status: String,
    pub user_uuid: Uuid,
    pub client_uuid: Option<Uuid>,
    pub r#type: String,
    pub notes: Option<String>,
}

/// Summary row used when listing projects with aggregate metadata.
#[derive(Debug, Clone, PartialEq, Eq, FromRow)]
pub struct ProjectListRecord {
    pub project_uuid: Uuid,
    pub project_name: String,
    pub creation_date: String,
    pub update_date: String,
    pub project_status: String,
    pub user_uuid: Uuid,
    pub client_uuid: Option<Uuid>,
    pub client_name: Option<String>,
    pub r#type: String,
    pub notes: Option<String>,
    pub subjects: Json<Vec<String>>,
    pub file_count: i64,
}

/// Row representation of `project_subjects`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ProjectSubjectRecord {
    pub project_uuid: Uuid,
    pub subject: String,
}

/// Row representation of `project_language_pairs`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ProjectLanguagePairRecord {
    pub project_uuid: Uuid,
    pub source_lang: String,
    pub target_lang: String,
}

/// Row representation of the `file_info` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct FileInfoRecord {
    pub file_uuid: Uuid,
    pub ext: String,
    pub r#type: String,
    pub size_bytes: Option<i64>,
    pub segment_count: Option<i64>,
    pub token_count: Option<i64>,
    pub notes: Option<String>,
}

/// Row representation of the `project_files` association table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ProjectFileRecord {
    pub project_uuid: Uuid,
    pub file_uuid: Uuid,
    pub filename: String,
    pub stored_at: String,
    pub r#type: String,
}

/// Row representation of the `file_language_pairs` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct FileLanguagePairRecord {
    pub project_uuid: Uuid,
    pub file_uuid: Uuid,
    pub source_lang: String,
    pub target_lang: String,
}

/// Row representation of the `artifacts` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct ArtifactRecord {
    pub artifact_uuid: Uuid,
    pub project_uuid: Uuid,
    pub file_uuid: Uuid,
    pub artifact_type: String,
    pub size_bytes: Option<i64>,
    pub segment_count: Option<i64>,
    pub token_count: Option<i64>,
    pub status: String,
}

/// Row representation of the `jobs` table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct JobRecord {
    pub artifact_uuid: Uuid,
    pub job_type: String,
    pub project_uuid: Uuid,
    pub job_status: String,
    pub error_log: Option<String>,
}

/// Aggregated view of a user and their associated roles and permission overrides.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserProfile {
    pub user: UserRecord,
    pub roles: Vec<UserRoleRecord>,
    pub permission_overrides: Vec<UserPermissionOverrideRecord>,
}

/// Aggregated view of a file including metadata and language pairs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectFileBundle {
    pub link: ProjectFileRecord,
    pub info: FileInfoRecord,
    pub language_pairs: Vec<FileLanguagePairRecord>,
    pub artifacts: Vec<ArtifactRecord>,
}

/// Aggregated view of a project alongside related collections.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectBundle {
    pub project: ProjectRecord,
    pub subjects: Vec<ProjectSubjectRecord>,
    pub language_pairs: Vec<ProjectLanguagePairRecord>,
    pub files: Vec<ProjectFileBundle>,
    pub jobs: Vec<JobRecord>,
}

/// Input describing a permission override change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PermissionOverrideInput {
    pub permission: String,
    pub is_allowed: bool,
}

/// Arguments required to create a user and optional role/permission lists.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewUserArgs {
    pub user_uuid: Uuid,
    pub username: String,
    pub email: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub roles: Vec<String>,
    pub permission_overrides: Vec<PermissionOverrideInput>,
}

/// Arguments for updating an existing user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateUserArgs {
    pub user_uuid: Uuid,
    pub username: Option<String>,
    pub email: Option<String>,
    pub phone: Option<Option<String>>,
    pub address: Option<Option<String>>,
    pub roles: Option<Vec<String>>,
    pub permission_overrides: Option<Vec<PermissionOverrideInput>>,
}

/// Arguments for creating a client.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewClientArgs {
    pub client_uuid: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub vat_number: Option<String>,
    pub note: Option<String>,
}

/// Arguments for updating a client.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateClientArgs {
    pub client_uuid: Uuid,
    pub name: Option<String>,
    pub email: Option<Option<String>>,
    pub phone: Option<Option<String>>,
    pub address: Option<Option<String>>,
    pub vat_number: Option<Option<String>>,
    pub note: Option<Option<String>>,
}

/// Arguments describing a project language pair.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectLanguagePairInput {
    pub source_lang: String,
    pub target_lang: String,
}

/// Arguments describing a project subject tag.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectSubjectInput {
    pub subject: String,
}

/// Arguments to create a project with initial relationships.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewProjectArgs {
    pub project_uuid: Uuid,
    pub project_name: String,
    pub project_status: String,
    pub user_uuid: Uuid,
    pub client_uuid: Option<Uuid>,
    pub r#type: String,
    pub notes: Option<String>,
    pub subjects: Vec<ProjectSubjectInput>,
    pub language_pairs: Vec<ProjectLanguagePairInput>,
}

/// Arguments to update an existing project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateProjectArgs {
    pub project_uuid: Uuid,
    pub project_name: Option<String>,
    pub project_status: Option<String>,
    pub user_uuid: Option<Uuid>,
    pub client_uuid: Option<Option<Uuid>>,
    pub r#type: Option<String>,
    pub notes: Option<Option<String>>,
    pub subjects: Option<Vec<ProjectSubjectInput>>,
    pub language_pairs: Option<Vec<ProjectLanguagePairInput>>,
}

/// Arguments describing file metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewFileInfoArgs {
    pub file_uuid: Uuid,
    pub ext: String,
    pub r#type: String,
    pub size_bytes: Option<i64>,
    pub segment_count: Option<i64>,
    pub token_count: Option<i64>,
    pub notes: Option<String>,
}

/// Arguments describing link between project and file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewProjectFileArgs {
    pub project_uuid: Uuid,
    pub file_uuid: Uuid,
    pub filename: String,
    pub stored_at: String,
    pub r#type: String,
    pub language_pairs: Vec<FileLanguagePairInput>,
}

/// Arguments describing a file language pair insert.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileLanguagePairInput {
    pub source_lang: String,
    pub target_lang: String,
}

/// Arguments describing artifact creation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewArtifactArgs {
    pub artifact_uuid: Uuid,
    pub project_uuid: Uuid,
    pub file_uuid: Uuid,
    pub artifact_type: String,
    pub size_bytes: Option<i64>,
    pub segment_count: Option<i64>,
    pub token_count: Option<i64>,
    pub status: String,
}

/// Arguments describing artifact status updates.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateArtifactStatusArgs {
    pub artifact_uuid: Uuid,
    pub status: String,
    pub size_bytes: Option<i64>,
    pub segment_count: Option<i64>,
    pub token_count: Option<i64>,
}

/// Arguments to create a job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewJobArgs {
    pub artifact_uuid: Uuid,
    pub job_type: String,
    pub project_uuid: Uuid,
    pub job_status: String,
    pub error_log: Option<String>,
}

/// Arguments to update job status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateJobStatusArgs {
    pub artifact_uuid: Uuid,
    pub job_type: String,
    pub job_status: String,
    pub error_log: Option<String>,
}

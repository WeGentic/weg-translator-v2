use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use log::{debug, error, warn};
use serde_json::Value;
use sqlx::{Executor, Row, Sqlite, SqlitePool, Transaction, sqlite::SqlitePoolOptions};
use thiserror::Error;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use crate::ipc::dto::{
    StoredTranslationJob, TranslationHistoryRecord, TranslationOutputSnapshot, TranslationRequest,
    TranslationStage,
};

pub const SQLITE_DB_FILE: &str = "weg_translator.db";
const PROJECT_FILE_CONVERSION_COLUMNS: &str = "id, project_file_id, src_lang, tgt_lang, version, paragraph, embed, xliff_rel_path, jliff_rel_path, tag_map_rel_path, status, started_at, completed_at, failed_at, error_message, created_at, updated_at";
const SKIP_CONVERSION_EXTENSIONS: &[&str] = &["xlf", "xliff", "mqxliff", "sdlxliff"];
const CONVERTIBLE_EXTENSIONS: &[&str] = &[
    "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "html", "xml", "dita", "md",
];

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Clone)]
pub struct DbManager {
    pool: Arc<RwLock<SqlitePool>>,
    write_lock: Arc<Mutex<()>>,
}

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

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Clone)]
pub struct NewTranslationRecord {
    pub job_id: Uuid,
    pub request: TranslationRequest,
}

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectType {
    Translation,
    Rag,
}

impl ProjectType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectType::Translation => "translation",
            ProjectType::Rag => "rag",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "translation" => Some(Self::Translation),
            "rag" => Some(Self::Rag),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectStatus {
    Active,
    Archived,
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectStatus::Active => "active",
            ProjectStatus::Archived => "archived",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "active" => Some(Self::Active),
            "archived" => Some(Self::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileImportStatus {
    Imported,
    Failed,
}

impl ProjectFileImportStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileImportStatus::Imported => "imported",
            ProjectFileImportStatus::Failed => "failed",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "imported" => Some(Self::Imported),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectFileConversionStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl ProjectFileConversionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectFileConversionStatus::Pending => "pending",
            ProjectFileConversionStatus::Running => "running",
            ProjectFileConversionStatus::Completed => "completed",
            ProjectFileConversionStatus::Failed => "failed",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(Self::Pending),
            "running" => Some(Self::Running),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct NewProjectFileConversion {
    pub id: Uuid,
    pub project_file_id: Uuid,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
    pub xliff_rel_path: Option<String>,
    pub jliff_rel_path: Option<String>,
    pub tag_map_rel_path: Option<String>,
    pub status: ProjectFileConversionStatus,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub failed_at: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ProjectFileConversionRequest {
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
}

impl ProjectFileConversionRequest {
    pub fn new<S1, S2, S3>(src_lang: S1, tgt_lang: S2, version: S3) -> Self
    where
        S1: Into<String>,
        S2: Into<String>,
        S3: Into<String>,
    {
        Self {
            src_lang: src_lang.into(),
            tgt_lang: tgt_lang.into(),
            version: version.into(),
            paragraph: true,
            embed: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProjectFileDetails {
    pub id: Uuid,
    pub original_name: String,
    pub stored_rel_path: String,
    pub ext: String,
    pub size_bytes: Option<i64>,
    pub import_status: ProjectFileImportStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct ProjectFileConversionRow {
    pub id: Uuid,
    pub project_file_id: Uuid,
    pub src_lang: String,
    pub tgt_lang: String,
    pub version: String,
    pub paragraph: bool,
    pub embed: bool,
    pub xliff_rel_path: Option<String>,
    pub jliff_rel_path: Option<String>,
    pub tag_map_rel_path: Option<String>,
    pub status: ProjectFileConversionStatus,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub failed_at: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct ProjectFileWithConversions {
    pub file: ProjectFileDetails,
    pub conversions: Vec<ProjectFileConversionRow>,
}

#[derive(Debug, Clone)]
pub struct ProjectDetails {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub default_src_lang: Option<String>,
    pub default_tgt_lang: Option<String>,
    pub root_path: String,
    pub files: Vec<ProjectFileWithConversions>,
}

#[derive(Debug, Clone)]
pub struct NewProject {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub project_type: ProjectType,
    pub root_path: String,
    pub status: ProjectStatus,
    pub default_src_lang: Option<String>,
    pub default_tgt_lang: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct NewProjectFile {
    pub id: Uuid,
    pub project_id: Uuid,
    pub original_name: String,
    pub original_path: String,
    pub stored_rel_path: String,
    pub ext: String,
    pub size_bytes: Option<i64>,
    pub checksum_sha256: Option<String>,
    pub import_status: ProjectFileImportStatus,
}

#[derive(Debug, Clone)]
pub struct ProjectListItem {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub project_type: ProjectType,
    pub root_path: String,
    pub status: ProjectStatus,
    pub created_at: String,
    pub updated_at: String,
    pub file_count: i64,
    pub activity_status: String,
}

impl DbManager {
    pub async fn new_with_base_dir(base_dir: &Path) -> DbResult<Self> {
        fs::create_dir_all(base_dir)?;
        let pool = Self::connect_pool(base_dir).await?;
        Ok(Self {
            pool: Arc::new(RwLock::new(pool)),
            write_lock: Arc::new(Mutex::new(())),
        })
    }

    pub fn from_pool(pool: SqlitePool) -> Self {
        Self {
            pool: Arc::new(RwLock::new(pool)),
            write_lock: Arc::new(Mutex::new(())),
        }
    }

    async fn pool(&self) -> SqlitePool {
        self.pool.read().await.clone()
    }

    async fn connect_pool(base_dir: &Path) -> Result<SqlitePool, sqlx::Error> {
        let db_path = base_dir.join(SQLITE_DB_FILE);
        let connection_url = format!("sqlite://{}", db_path.to_string_lossy());
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&connection_url)
            .await?;
        MIGRATOR.run(&pool).await?;
        Ok(pool)
    }

    pub async fn reopen_with_base_dir(&self, base_dir: &Path) -> DbResult<()> {
        fs::create_dir_all(base_dir)?;
        let new_pool = Self::connect_pool(base_dir).await?;
        let _guard = self.write_lock.lock().await;
        let mut writer = self.pool.write().await;
        let old_pool = std::mem::replace(&mut *writer, new_pool);
        drop(writer);
        old_pool.close().await;
        Ok(())
    }

    pub async fn update_project_root_paths(
        &self,
        old_base: &Path,
        new_base: &Path,
    ) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let projects = sqlx::query("SELECT id, root_path FROM projects")
            .fetch_all(&mut *tx)
            .await?;

        let mut updated = 0u64;
        let now = now_iso8601();

        for row in projects {
            let id: String = row.try_get("id")?;
            let root_path: String = row.try_get("root_path")?;
            let current_path = PathBuf::from(&root_path);

            if let Ok(relative) = current_path.strip_prefix(old_base) {
                let candidate = new_base.join(relative);
                if candidate != current_path {
                    let candidate_str = candidate.to_string_lossy().to_string();
                    let result = sqlx::query(
                        "UPDATE projects SET root_path = ?1, updated_at = ?2 WHERE id = ?3",
                    )
                    .bind(&candidate_str)
                    .bind(&now)
                    .bind(&id)
                    .execute(&mut *tx)
                    .await?;

                    updated += result.rows_affected();
                }
            }
        }

        tx.commit().await?;

        if updated > 0 {
            debug!(
                target: "db::projects",
                "updated root paths for {updated} project(s) after storage migration"
            );
        }

        Ok(updated)
    }

    pub async fn insert_job(&self, record: &NewTranslationRecord) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let now = now_iso8601();
        let metadata = record
            .request
            .metadata
            .as_ref()
            .map(|value| serde_json::to_string(value))
            .transpose()?;

        let job_id_str = record.job_id.to_string();
        let pool = self.pool().await;

        let query = sqlx::query(
            "INSERT INTO translation_jobs (id, source_language, target_language, input_text, status, stage, progress, queued_at, created_at, updated_at, metadata) VALUES (?1, ?2, ?3, ?4, 'queued', 'received', 0.0, ?5, ?5, ?5, ?6)"
        )
        .bind(&job_id_str)
        .bind(&record.request.source_language)
        .bind(&record.request.target_language)
        .bind(&record.request.text)
        .bind(&now)
        .bind(metadata);

        match query.execute(&pool).await {
            Ok(_) => {
                debug!(
                    target: "db::jobs",
                    "persisted translation job {job_id_str} ({source}->{target})",
                    source = record.request.source_language,
                    target = record.request.target_language
                );
                Ok(())
            }
            Err(error) => {
                if is_translation_job_unique_violation(&error) {
                    warn!(
                        target: "db::jobs",
                        "duplicate translation job detected for id {job_id_str}"
                    );
                    Err(DbError::DuplicateJob(record.job_id))
                } else {
                    error!(
                        target: "db::jobs",
                        "failed to insert translation job {job_id_str}: {error}"
                    );
                    Err(error.into())
                }
            }
        }
    }

    pub async fn update_progress(
        &self,
        job_id: Uuid,
        stage: TranslationStage,
        progress: f32,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let status = match stage {
            TranslationStage::Completed => "completed",
            TranslationStage::Failed => "failed",
            _ => "running",
        };
        let now = now_iso8601();
        let stage_str = stage.as_db_value();
        let started_at = matches!(stage, TranslationStage::Preparing).then(|| now.clone());

        let job_id_str = job_id.to_string();
        let pool = self.pool().await;
        let result = sqlx::query(
            "UPDATE translation_jobs
             SET status = ?1,
                 stage = ?2,
                 progress = ?3,
                 started_at = CASE WHEN started_at IS NULL AND ?4 IS NOT NULL THEN ?4 ELSE started_at END,
                 failure_reason = NULL,
                 failed_at = NULL,
                 updated_at = ?5
             WHERE id = ?6"
        )
        .bind(status)
        .bind(stage_str)
        .bind(progress.clamp(0.0, 1.0))
        .bind(started_at.as_deref())
        .bind(&now)
        .bind(&job_id_str)
        .execute(&pool)
        .await;

        match result {
            Ok(result) => {
                if result.rows_affected() == 0 {
                    warn!(
                        target: "db::jobs",
                        "attempted to update nonexistent job {job_id_str}"
                    );
                    Err(DbError::NotFound(job_id))
                } else {
                    debug!(
                        target: "db::jobs",
                        "updated job {job_id_str} to {stage:?} ({progress:.2})"
                    );
                    Ok(())
                }
            }
            Err(error) => {
                error!(
                    target: "db::jobs",
                    "failed to update progress for {job_id_str}: {error}"
                );
                Err(error.into())
            }
        }
    }

    pub async fn mark_failed(&self, job_id: Uuid, reason: &str) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let now = now_iso8601();
        let job_id_str = job_id.to_string();
        let pool = self.pool().await;
        let result = sqlx::query(
            "UPDATE translation_jobs
             SET status = 'failed',
                 stage = 'failed',
                 progress = 1.0,
                 failed_at = ?1,
                 updated_at = ?1,
                 failure_reason = ?2
             WHERE id = ?3",
        )
        .bind(&now)
        .bind(reason)
        .bind(&job_id_str)
        .execute(&pool)
        .await;

        match result {
            Ok(result) => {
                if result.rows_affected() == 0 {
                    warn!(
                        target: "db::jobs",
                        "attempted to mark nonexistent job {job_id_str} as failed"
                    );
                    Err(DbError::NotFound(job_id))
                } else {
                    debug!(
                        target: "db::jobs",
                        "marked job {job_id_str} as failed: {reason}"
                    );
                    Ok(())
                }
            }
            Err(error) => {
                error!(
                    target: "db::jobs",
                    "failed to mark job {job_id_str} as failed: {error}"
                );
                Err(error.into())
            }
        }
    }

    pub async fn store_output(&self, output: &PersistedTranslationOutput) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;
        let now = now_iso8601();
        let job_id_str = output.job_id.to_string();

        let update = sqlx::query(
            "UPDATE translation_jobs
             SET status = 'completed',
                 stage = 'completed',
                 progress = 1.0,
                 completed_at = ?1,
                 updated_at = ?1,
                 failure_reason = NULL,
                 failed_at = NULL
             WHERE id = ?2",
        )
        .bind(&now)
        .bind(&job_id_str)
        .execute(&mut *tx)
        .await;

        let update = match update {
            Ok(result) => result,
            Err(error) => {
                error!(
                    target: "db::jobs",
                    "failed to mark job {job_id_str} as completed: {error}"
                );
                tx.rollback().await.ok();
                return Err(error.into());
            }
        };

        if update.rows_affected() == 0 {
            warn!(
                target: "db::jobs",
                "attempted to store output for unknown job {job_id_str}"
            );
            tx.rollback().await.ok();
            return Err(DbError::NotFound(output.job_id));
        }

        let insert = sqlx::query(
            "INSERT INTO translation_outputs (job_id, output_text, model_name, input_token_count, output_token_count, total_token_count, duration_ms, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(job_id) DO UPDATE SET
                 output_text = excluded.output_text,
                 model_name = excluded.model_name,
                 input_token_count = excluded.input_token_count,
                 output_token_count = excluded.output_token_count,
                 total_token_count = excluded.total_token_count,
                 duration_ms = excluded.duration_ms,
                 updated_at = excluded.updated_at"
        )
        .bind(&job_id_str)
        .bind(&output.output_text)
        .bind(output.model_name.as_deref())
        .bind(output.input_token_count)
        .bind(output.output_token_count)
        .bind(output.total_token_count)
        .bind(output.duration_ms)
        .bind(&now)
        .execute(&mut *tx)
        .await;

        if let Err(error) = insert {
            error!(
                target: "db::jobs",
                "failed to upsert output for job {job_id_str}: {error}"
            );
            tx.rollback().await.ok();
            return Err(error.into());
        }

        tx.commit().await?;
        debug!(
            target: "db::jobs",
            "stored output for job {job_id_str} ({} bytes)",
            output.output_text.len()
        );
        Ok(())
    }

    pub async fn list_jobs(&self, limit: i64, offset: i64) -> DbResult<Vec<StoredTranslationJob>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT id, source_language, target_language, input_text, status, stage, progress, queued_at, started_at, completed_at, failed_at, failure_reason, metadata, updated_at
             FROM translation_jobs
             ORDER BY queued_at DESC
             LIMIT ?1 OFFSET ?2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

        rows.into_iter().map(|row| build_stored_job(&row)).collect()
    }

    pub async fn list_history(
        &self,
        limit: i64,
        offset: i64,
    ) -> DbResult<Vec<TranslationHistoryRecord>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT
                 j.id,
                 j.source_language,
                 j.target_language,
                 j.input_text,
                 j.status,
                 j.stage,
                 j.progress,
                 j.queued_at,
                 j.started_at,
                 j.completed_at,
                 j.failed_at,
                 j.failure_reason,
                 j.metadata,
                 j.updated_at,
                 o.output_text,
                 o.model_name,
                 o.input_token_count,
                 o.output_token_count,
                 o.total_token_count,
                 o.duration_ms,
                 o.created_at AS output_created_at,
                 o.updated_at AS output_updated_at
             FROM translation_jobs j
             LEFT JOIN translation_outputs o ON o.job_id = j.id
             WHERE j.status IN ('completed', 'failed')
             ORDER BY j.updated_at DESC
            LIMIT ?1 OFFSET ?2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

        rows.into_iter()
            .map(|row| build_history_record(row))
            .collect()
    }

    pub async fn get_job(&self, job_id: Uuid) -> DbResult<Option<TranslationHistoryRecord>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT
                 j.id,
                 j.source_language,
                 j.target_language,
                 j.input_text,
                 j.status,
                 j.stage,
                 j.progress,
                 j.queued_at,
                 j.started_at,
                 j.completed_at,
                 j.failed_at,
                 j.failure_reason,
                 j.metadata,
                 j.updated_at,
                 o.output_text,
                 o.model_name,
                 o.input_token_count,
                 o.output_token_count,
                 o.total_token_count,
                 o.duration_ms,
                 o.created_at AS output_created_at,
                 o.updated_at AS output_updated_at
             FROM translation_jobs j
             LEFT JOIN translation_outputs o ON o.job_id = j.id
             WHERE j.id = ?1",
        )
        .bind(job_id.to_string())
        .fetch_optional(&pool)
        .await?;

        row.map(build_history_record).transpose()
    }

    pub async fn insert_project_with_files(
        &self,
        project: &NewProject,
        files: &[NewProjectFile],
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        self.insert_project(project, &mut tx).await?;
        for file in files {
            self.insert_project_file(file, &mut tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn insert_project(
        &self,
        project: &NewProject,
        tx: &mut Transaction<'_, Sqlite>,
    ) -> DbResult<()> {
        let now = now_iso8601();
        let id = project.id.to_string();
        let metadata = project
            .metadata
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        let query = sqlx::query(
            "INSERT INTO projects (id, name, slug, project_type, root_path, status, default_src_lang, default_tgt_lang, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10)",
        )
        .bind(&id)
        .bind(&project.name)
        .bind(&project.slug)
        .bind(project.project_type.as_str())
        .bind(&project.root_path)
        .bind(project.status.as_str())
        .bind(project.default_src_lang.as_deref())
        .bind(project.default_tgt_lang.as_deref())
        .bind(&now)
        .bind(metadata);

        tx.execute(query).await?;

        debug!(
            target: "db::projects",
            "inserted project {id} ({name})",
            name = project.name
        );

        Ok(())
    }

    pub async fn insert_project_file(
        &self,
        file: &NewProjectFile,
        tx: &mut Transaction<'_, Sqlite>,
    ) -> DbResult<()> {
        let now = now_iso8601();
        let id = file.id.to_string();
        let project_id = file.project_id.to_string();

        let query = sqlx::query(
            "INSERT INTO project_files (id, project_id, original_name, original_path, stored_rel_path, ext, size_bytes, checksum_sha256, import_status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        )
        .bind(&id)
        .bind(&project_id)
        .bind(&file.original_name)
        .bind(&file.original_path)
        .bind(&file.stored_rel_path)
        .bind(&file.ext)
        .bind(file.size_bytes)
        .bind(file.checksum_sha256.as_deref())
        .bind(file.import_status.as_str())
        .bind(&now);

        tx.execute(query).await?;

        debug!(
            target: "db::project_files",
            "inserted project file {id} for project {project_id} ({original})",
            original = file.original_name
        );

        Ok(())
    }

    pub async fn insert_project_file_conversions(
        &self,
        rows: &[NewProjectFileConversion],
        tx: &mut Transaction<'_, Sqlite>,
    ) -> DbResult<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let now = now_iso8601();

        for row in rows {
            let id = row.id.to_string();
            let project_file_id = row.project_file_id.to_string();

            let query = sqlx::query(
                "INSERT INTO project_file_conversions (
                     id,
                     project_file_id,
                     src_lang,
                     tgt_lang,
                     version,
                     paragraph,
                     embed,
                     xliff_rel_path,
                     jliff_rel_path,
                     tag_map_rel_path,
                     status,
                     started_at,
                     completed_at,
                     failed_at,
                     error_message,
                     created_at,
                     updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)",
            )
            .bind(&id)
            .bind(&project_file_id)
            .bind(&row.src_lang)
            .bind(&row.tgt_lang)
            .bind(&row.version)
            .bind(row.paragraph as i64)
            .bind(row.embed as i64)
            .bind(row.xliff_rel_path.as_deref())
            .bind(row.jliff_rel_path.as_deref())
            .bind(row.tag_map_rel_path.as_deref())
            .bind(row.status.as_str())
            .bind(row.started_at.as_deref())
            .bind(row.completed_at.as_deref())
            .bind(row.failed_at.as_deref())
            .bind(row.error_message.as_deref())
            .bind(&now);

            tx.execute(query).await?;

            debug!(
                target: "db::project_file_conversions",
                "inserted conversion {id} for file {project_file_id} ({src}->{tgt} v{version})",
                src = row.src_lang,
                tgt = row.tgt_lang,
                version = row.version
            );
        }

        Ok(())
    }

    pub async fn upsert_conversion_status(
        &self,
        conversion_id: Uuid,
        status: ProjectFileConversionStatus,
        xliff_rel_path: Option<String>,
        jliff_rel_path: Option<String>,
        tag_map_rel_path: Option<String>,
        error_message: Option<String>,
        started_at: Option<String>,
        completed_at: Option<String>,
        failed_at: Option<String>,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let now = now_iso8601();
        let id = conversion_id.to_string();

        let updated = sqlx::query(
            "UPDATE project_file_conversions
             SET status = ?1,
                 xliff_rel_path = ?2,
                 jliff_rel_path = ?3,
                 tag_map_rel_path = ?4,
                 error_message = ?5,
                 started_at = ?6,
                 completed_at = ?7,
                 failed_at = ?8,
                 updated_at = ?9
             WHERE id = ?10",
        )
        .bind(status.as_str())
        .bind(xliff_rel_path.as_deref())
        .bind(jliff_rel_path.as_deref())
        .bind(tag_map_rel_path.as_deref())
        .bind(error_message.as_deref())
        .bind(started_at.as_deref())
        .bind(completed_at.as_deref())
        .bind(failed_at.as_deref())
        .bind(&now)
        .bind(&id)
        .execute(tx.as_mut())
        .await?;

        if updated.rows_affected() == 0 {
            return Err(DbError::ProjectFileConversionNotFound(conversion_id));
        }

        tx.commit().await?;

        debug!(
            target: "db::project_file_conversions",
            "updated conversion {id} status -> {status}",
            id = id,
            status = status.as_str()
        );

        Ok(())
    }

    pub async fn find_or_create_conversion_for_file(
        &self,
        project_file_id: Uuid,
        request: &ProjectFileConversionRequest,
    ) -> DbResult<ProjectFileConversionRow> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let row = self
            .find_or_create_conversion_for_file_tx(&mut tx, project_file_id, request)
            .await?;

        tx.commit().await?;
        Ok(row)
    }

    async fn find_or_create_conversion_for_file_tx(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        project_file_id: Uuid,
        request: &ProjectFileConversionRequest,
    ) -> DbResult<ProjectFileConversionRow> {
        let paragraph_flag = if request.paragraph { 1 } else { 0 };
        let embed_flag = if request.embed { 1 } else { 0 };
        let file_id = project_file_id.to_string();

        let select_existing = format!(
            "SELECT {columns} FROM project_file_conversions
             WHERE project_file_id = ?1
               AND src_lang = ?2
               AND tgt_lang = ?3
               AND version = ?4
               AND paragraph = ?5
               AND embed = ?6
             LIMIT 1",
            columns = PROJECT_FILE_CONVERSION_COLUMNS,
        );

        if let Some(row) = sqlx::query(&select_existing)
            .bind(&file_id)
            .bind(&request.src_lang)
            .bind(&request.tgt_lang)
            .bind(&request.version)
            .bind(paragraph_flag)
            .bind(embed_flag)
            .fetch_optional(tx.as_mut())
            .await?
        {
            return build_project_file_conversion(&row);
        }

        let new_conversion = NewProjectFileConversion {
            id: Uuid::new_v4(),
            project_file_id,
            src_lang: request.src_lang.clone(),
            tgt_lang: request.tgt_lang.clone(),
            version: request.version.clone(),
            paragraph: request.paragraph,
            embed: request.embed,
            xliff_rel_path: None,
            jliff_rel_path: None,
            tag_map_rel_path: None,
            status: ProjectFileConversionStatus::Pending,
            started_at: None,
            completed_at: None,
            failed_at: None,
            error_message: None,
        };

        let conversion_id = new_conversion.id;

        self.insert_project_file_conversions(std::slice::from_ref(&new_conversion), tx)
            .await?;

        let select_inserted = format!(
            "SELECT {columns} FROM project_file_conversions WHERE id = ?1",
            columns = PROJECT_FILE_CONVERSION_COLUMNS,
        );

        let inserted_row = sqlx::query(&select_inserted)
            .bind(&conversion_id.to_string())
            .fetch_one(tx.as_mut())
            .await?;

        build_project_file_conversion(&inserted_row)
    }

    pub async fn list_projects(&self, limit: i64, offset: i64) -> DbResult<Vec<ProjectListItem>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT
                 p.id,
                 p.name,
                 p.slug,
                 p.project_type,
                 p.root_path,
                 p.status,
                 p.created_at,
                 p.updated_at,
                 COALESCE(COUNT(DISTINCT f.id), 0) AS file_count,
                 CASE
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'running' THEN 1 ELSE 0 END), 0) > 0 THEN 'running'
                   WHEN COALESCE(COUNT(c.id), 0) = 0 THEN 'pending'
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END), 0) > 0 THEN 'pending'
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END), 0) = COALESCE(COUNT(c.id), 0) AND COALESCE(COUNT(c.id), 0) > 0 THEN 'completed'
                   ELSE 'failed'
                 END AS activity_status
             FROM projects p
             LEFT JOIN project_files f ON f.project_id = p.id
             LEFT JOIN project_file_conversions c ON c.project_file_id = f.id
             GROUP BY p.id
             ORDER BY p.updated_at DESC
             LIMIT ?1 OFFSET ?2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

        rows.into_iter()
            .map(|row| build_project_list_item(row))
            .collect()
    }

    pub async fn list_project_details(&self, project_id: Uuid) -> DbResult<ProjectDetails> {
        let pool = self.pool().await;
        let project_id_str = project_id.to_string();

        let select_project = sqlx::query(
            "SELECT id, name, slug, default_src_lang, default_tgt_lang, root_path
             FROM projects WHERE id = ?1",
        )
        .bind(&project_id_str)
        .fetch_optional(&pool)
        .await?;

        let project_row = match select_project {
            Some(row) => row,
            None => return Err(DbError::ProjectNotFound(project_id)),
        };

        let name: String = project_row.try_get("name")?;
        let slug: String = project_row.try_get("slug")?;
        let default_src_lang: Option<String> = project_row.try_get("default_src_lang")?;
        let default_tgt_lang: Option<String> = project_row.try_get("default_tgt_lang")?;
        let root_path: String = project_row.try_get("root_path")?;

        let file_rows = sqlx::query(
            "SELECT id, original_name, stored_rel_path, ext, size_bytes, import_status, created_at, updated_at
             FROM project_files
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&project_id_str)
        .fetch_all(&pool)
        .await?;

        let mut files = Vec::with_capacity(file_rows.len());

        for row in file_rows {
            let details = build_project_file_details(&row)?;
            let select_conversions = format!(
                "SELECT {columns} FROM project_file_conversions
                 WHERE project_file_id = ?1
                 ORDER BY created_at ASC",
                columns = PROJECT_FILE_CONVERSION_COLUMNS,
            );

            let conversion_rows = sqlx::query(&select_conversions)
                .bind(&details.id.to_string())
                .fetch_all(&pool)
                .await?;

            let mut conversions = Vec::with_capacity(conversion_rows.len());
            for conversion_row in conversion_rows {
                conversions.push(build_project_file_conversion(&conversion_row)?);
            }

            files.push(ProjectFileWithConversions {
                file: details,
                conversions,
            });
        }

        Ok(ProjectDetails {
            id: project_id,
            name,
            slug,
            default_src_lang,
            default_tgt_lang,
            root_path,
            files,
        })
    }

    pub async fn add_files_to_project(
        &self,
        project_id: Uuid,
        new_files: &[NewProjectFile],
    ) -> DbResult<Vec<ProjectFileDetails>> {
        if new_files.is_empty() {
            return Ok(Vec::new());
        }

        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        for file in new_files {
            self.insert_project_file(file, &mut tx).await?;
        }

        let mut inserted = Vec::with_capacity(new_files.len());
        for file in new_files {
            let row = sqlx::query(
                "SELECT id, original_name, stored_rel_path, ext, size_bytes, import_status, created_at, updated_at
                 FROM project_files WHERE id = ?1 AND project_id = ?2",
            )
            .bind(&file.id.to_string())
            .bind(&project_id.to_string())
            .fetch_one(tx.as_mut())
            .await?;

            inserted.push(build_project_file_details(&row)?);
        }

        tx.commit().await?;

        Ok(inserted)
    }

    pub async fn remove_project_file(
        &self,
        project_id: Uuid,
        project_file_id: Uuid,
    ) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let removed = sqlx::query("DELETE FROM project_files WHERE id = ?1 AND project_id = ?2")
            .bind(&project_file_id.to_string())
            .bind(&project_id.to_string())
            .execute(tx.as_mut())
            .await?;

        tx.commit().await?;

        Ok(removed.rows_affected())
    }

    pub async fn list_pending_conversions(
        &self,
        project_id: Uuid,
        src_lang: &str,
        tgt_lang: &str,
    ) -> DbResult<Vec<ProjectFileConversionRow>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let request = ProjectFileConversionRequest::new(src_lang, tgt_lang, "2.0");
        let select_files =
            sqlx::query("SELECT id, ext, import_status FROM project_files WHERE project_id = ?1")
                .bind(&project_id.to_string())
                .fetch_all(tx.as_mut())
                .await?;

        let mut pending = Vec::new();

        for row in select_files {
            let file_id_raw: String = row.try_get("id")?;
            let file_id = Uuid::parse_str(&file_id_raw)
                .map_err(|_| DbError::InvalidProjectId(file_id_raw.clone()))?;

            let ext: String = row.try_get("ext")?;
            if SKIP_CONVERSION_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            }
            if !CONVERTIBLE_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            }

            let import_status_raw: String = row.try_get("import_status")?;
            let import_status = ProjectFileImportStatus::from_str(&import_status_raw)
                .ok_or_else(|| DbError::InvalidProjectFileStatus(import_status_raw.clone()))?;

            if import_status != ProjectFileImportStatus::Imported {
                continue;
            }

            let conversion = self
                .find_or_create_conversion_for_file_tx(&mut tx, file_id, &request)
                .await?;

            if matches!(
                conversion.status,
                ProjectFileConversionStatus::Pending | ProjectFileConversionStatus::Failed
            ) {
                pending.push(conversion);
            }
        }

        tx.commit().await?;

        Ok(pending)
    }

    pub async fn project_root_path(&self, project_id: Uuid) -> DbResult<PathBuf> {
        let pool = self.pool().await;
        let project_row = sqlx::query("SELECT root_path FROM projects WHERE id = ?1")
            .bind(&project_id.to_string())
            .fetch_optional(&pool)
            .await?;

        match project_row {
            Some(row) => {
                let root: String = row.try_get("root_path")?;
                Ok(PathBuf::from(root))
            }
            None => Err(DbError::ProjectNotFound(project_id)),
        }
    }

    pub async fn delete_project(&self, project_id: Uuid) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let deleted = sqlx::query("DELETE FROM projects WHERE id = ?1")
            .bind(&project_id.to_string())
            .execute(tx.as_mut())
            .await?;

        tx.commit().await?;

        Ok(deleted.rows_affected())
    }

    pub fn ensure_subdir(root: &Path, name: &str) -> DbResult<PathBuf> {
        let target = root.join(name);
        fs::create_dir_all(&target)?;
        Ok(target)
    }

    pub async fn clear_history(&self) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;
        sqlx::query(
            "DELETE FROM translation_outputs WHERE job_id IN (
                SELECT id FROM translation_jobs WHERE status IN ('completed', 'failed')
            )",
        )
        .execute(&mut *tx)
        .await?;

        let deleted =
            sqlx::query("DELETE FROM translation_jobs WHERE status IN ('completed', 'failed')")
                .execute(&mut *tx)
                .await?;

        tx.commit().await?;
        if deleted.rows_affected() > 0 {
            debug!(
                target: "db::jobs",
                "cleared {count} completed jobs",
                count = deleted.rows_affected()
            );
        }
        Ok(deleted.rows_affected())
    }
}

fn build_stored_job(row: &sqlx::sqlite::SqliteRow) -> DbResult<StoredTranslationJob> {
    let stage_str: String = row.try_get("stage")?;
    let stage = TranslationStage::from_db_value(&stage_str)
        .ok_or_else(|| DbError::InvalidStage(stage_str.clone()))?;

    let metadata: Option<String> = row.try_get("metadata")?;
    let metadata = match metadata {
        Some(raw) => Some(serde_json::from_str::<Value>(&raw)?),
        None => None,
    };

    let id_str: String = row.try_get("id")?;
    let job_id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidUuid(id_str.clone()))?;

    let job = StoredTranslationJob {
        job_id,
        source_language: row.try_get("source_language")?,
        target_language: row.try_get("target_language")?,
        input_text: row.try_get("input_text")?,
        status: row.try_get("status")?,
        stage,
        progress: row.try_get("progress")?,
        queued_at: row.try_get("queued_at")?,
        started_at: row.try_get("started_at")?,
        completed_at: row.try_get("completed_at")?,
        failed_at: row.try_get("failed_at")?,
        failure_reason: row.try_get("failure_reason")?,
        metadata,
        updated_at: row.try_get("updated_at")?,
    };

    Ok(job)
}

fn build_history_record(row: sqlx::sqlite::SqliteRow) -> DbResult<TranslationHistoryRecord> {
    let job = build_stored_job(&row)?;

    let output_text: Option<String> = row.try_get("output_text")?;
    let output_created_at: Option<String> = row.try_get("output_created_at")?;
    let output_updated_at: Option<String> = row.try_get("output_updated_at")?;

    let output = output_text.map(|text| TranslationOutputSnapshot {
        output_text: text,
        model_name: row.try_get("model_name").ok(),
        input_token_count: row.try_get("input_token_count").ok(),
        output_token_count: row.try_get("output_token_count").ok(),
        total_token_count: row.try_get("total_token_count").ok(),
        duration_ms: row.try_get("duration_ms").ok(),
        created_at: output_created_at.clone().unwrap_or_default(),
        updated_at: output_updated_at.clone().unwrap_or_default(),
    });

    Ok(TranslationHistoryRecord { job, output })
}

fn build_project_list_item(row: sqlx::sqlite::SqliteRow) -> DbResult<ProjectListItem> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let project_type_raw: String = row.try_get("project_type")?;
    let project_type = ProjectType::from_str(&project_type_raw)
        .ok_or_else(|| DbError::InvalidProjectType(project_type_raw.clone()))?;

    let status_raw: String = row.try_get("status")?;
    let status = ProjectStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidProjectStatus(status_raw.clone()))?;

    let name: String = row.try_get("name")?;
    let slug: String = row.try_get("slug")?;
    let root_path: String = row.try_get("root_path")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;
    let file_count: i64 = row.try_get("file_count")?;
    let activity_status: String = row.try_get("activity_status")?;

    Ok(ProjectListItem {
        id,
        name,
        slug,
        project_type,
        root_path,
        status,
        created_at,
        updated_at,
        file_count,
        activity_status,
    })
}

fn build_project_file_details(row: &sqlx::sqlite::SqliteRow) -> DbResult<ProjectFileDetails> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let import_status_raw: String = row.try_get("import_status")?;
    let import_status = ProjectFileImportStatus::from_str(&import_status_raw)
        .ok_or_else(|| DbError::InvalidProjectFileStatus(import_status_raw.clone()))?;

    Ok(ProjectFileDetails {
        id,
        original_name: row.try_get("original_name")?,
        stored_rel_path: row.try_get("stored_rel_path")?,
        ext: row.try_get("ext")?,
        size_bytes: row.try_get("size_bytes")?,
        import_status,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn build_project_file_conversion(
    row: &sqlx::sqlite::SqliteRow,
) -> DbResult<ProjectFileConversionRow> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let file_id_raw: String = row.try_get("project_file_id")?;
    let project_file_id = Uuid::parse_str(&file_id_raw)
        .map_err(|_| DbError::InvalidProjectId(file_id_raw.clone()))?;

    let status_raw: String = row.try_get("status")?;
    let status = ProjectFileConversionStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidProjectFileConversionStatus(status_raw.clone()))?;

    let paragraph_value: i64 = row.try_get("paragraph")?;
    let embed_value: i64 = row.try_get("embed")?;

    Ok(ProjectFileConversionRow {
        id,
        project_file_id,
        src_lang: row.try_get("src_lang")?,
        tgt_lang: row.try_get("tgt_lang")?,
        version: row.try_get("version")?,
        paragraph: paragraph_value != 0,
        embed: embed_value != 0,
        xliff_rel_path: row.try_get("xliff_rel_path")?,
        jliff_rel_path: row.try_get("jliff_rel_path")?,
        tag_map_rel_path: row.try_get("tag_map_rel_path")?,
        status,
        started_at: row.try_get("started_at")?,
        completed_at: row.try_get("completed_at")?,
        failed_at: row.try_get("failed_at")?,
        error_message: row.try_get("error_message")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn now_iso8601() -> String {
    let now = OffsetDateTime::now_utc();
    now.format(&Rfc3339).unwrap_or_else(|_| now.to_string())
}

fn is_translation_job_unique_violation(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Database(database_error) => {
            database_error.message().contains("translation_jobs.id")
        }
        _ => false,
    }
}

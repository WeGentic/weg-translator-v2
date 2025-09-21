use std::fs;
use std::path::Path;
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

#[derive(Debug, Clone)]
pub struct NewProject {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub project_type: ProjectType,
    pub root_path: String,
    pub status: ProjectStatus,
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
            "INSERT INTO projects (id, name, slug, project_type, root_path, status, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)",
        )
        .bind(&id)
        .bind(&project.name)
        .bind(&project.slug)
        .bind(project.project_type.as_str())
        .bind(&project.root_path)
        .bind(project.status.as_str())
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
                 COALESCE(COUNT(f.id), 0) AS file_count
             FROM projects p
             LEFT JOIN project_files f ON f.project_id = p.id
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

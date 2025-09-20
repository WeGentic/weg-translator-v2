use std::fs;
use std::sync::Arc;

use log::{debug, error, warn};
use serde_json::Value;
use sqlx::{Row, SqlitePool, sqlite::SqlitePoolOptions};
use tauri::{AppHandle, Manager};
use thiserror::Error;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::ipc::dto::{
    StoredTranslationJob, TranslationHistoryRecord, TranslationOutputSnapshot, TranslationRequest,
    TranslationStage,
};

pub const SQLITE_DB_FILE: &str = "weg_translator.db";
pub const SQLITE_DB_URL: &str = "sqlite:weg_translator.db";

#[derive(Clone)]
pub struct DbManager {
    pool: SqlitePool,
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

impl DbManager {
    pub async fn new(app: &AppHandle) -> DbResult<Self> {
        let dir = app.path().app_data_dir()?;
        fs::create_dir_all(&dir)?;
        let db_path = dir.join(SQLITE_DB_FILE);
        let connection_url = format!("sqlite://{}", db_path.to_string_lossy());
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&connection_url)
            .await?;

        Ok(Self {
            pool,
            write_lock: Arc::new(Mutex::new(())),
        })
    }

    pub fn from_pool(pool: SqlitePool) -> Self {
        Self {
            pool,
            write_lock: Arc::new(Mutex::new(())),
        }
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
        let query = sqlx::query(
            "INSERT INTO translation_jobs (id, source_language, target_language, input_text, status, stage, progress, queued_at, created_at, updated_at, metadata) VALUES (?1, ?2, ?3, ?4, 'queued', 'received', 0.0, ?5, ?5, ?5, ?6)"
        )
        .bind(&job_id_str)
        .bind(&record.request.source_language)
        .bind(&record.request.target_language)
        .bind(&record.request.text)
        .bind(&now)
        .bind(metadata);

        match query.execute(&self.pool).await {
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
        .execute(&self.pool)
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
        .execute(&self.pool)
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
        let mut tx = self.pool.begin().await?;
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
        let rows = sqlx::query(
            "SELECT id, source_language, target_language, input_text, status, stage, progress, queued_at, started_at, completed_at, failed_at, failure_reason, metadata, updated_at
             FROM translation_jobs
             ORDER BY queued_at DESC
             LIMIT ?1 OFFSET ?2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(|row| build_stored_job(&row)).collect()
    }

    pub async fn list_history(
        &self,
        limit: i64,
        offset: i64,
    ) -> DbResult<Vec<TranslationHistoryRecord>> {
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
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|row| build_history_record(row))
            .collect()
    }

    pub async fn get_job(&self, job_id: Uuid) -> DbResult<Option<TranslationHistoryRecord>> {
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
        .fetch_optional(&self.pool)
        .await?;

        row.map(build_history_record).transpose()
    }

    pub async fn clear_history(&self) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let mut tx = self.pool.begin().await?;
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

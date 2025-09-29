//! Translation job CRUD and history queries.

use log::{debug, error, warn};
use uuid::Uuid;

use crate::ipc::dto::{StoredTranslationJob, TranslationHistoryRecord, TranslationStage};

use crate::db::builders::{build_history_record, build_stored_job};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{NewTranslationRecord, PersistedTranslationOutput};
use crate::db::utils::{is_translation_job_unique_violation, now_iso8601};

impl DbManager {
    /// Inserts a new translation job record and ensures the job identifier remains unique.
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

    /// Updates the stage and progress for the given translation job.
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

    /// Marks a job as failed and persists the failure reason.
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

    /// Persists the final output for a completed translation job.
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
                    "failed to update job {job_id_str} as completed: {error}"
                );
                return Err(error.into());
            }
        };

        if update.rows_affected() == 0 {
            warn!(
                target: "db::jobs",
                "attempted to store output for nonexistent job {job_id_str}"
            );
            return Err(DbError::NotFound(output.job_id));
        }

        let insert = sqlx::query(
            "INSERT INTO translation_outputs (
                 job_id,
                 output_text,
                 model_name,
                 input_token_count,
                 output_token_count,
                 total_token_count,
                 duration_ms,
                 created_at,
                 updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(job_id) DO UPDATE SET
                 output_text = excluded.output_text,
                 model_name = excluded.model_name,
                 input_token_count = excluded.input_token_count,
                 output_token_count = excluded.output_token_count,
                 total_token_count = excluded.total_token_count,
                 duration_ms = excluded.duration_ms,
                 updated_at = excluded.updated_at",
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
                "failed to upsert translation output for {job_id_str}: {error}"
            );
            return Err(error.into());
        }

        tx.commit().await?;

        debug!(
            target: "db::jobs",
            "stored output snapshot for job {job_id_str}"
        );

        Ok(())
    }

    /// Returns queued and running jobs ordered by creation time.
    pub async fn list_jobs(&self, limit: i64, offset: i64) -> DbResult<Vec<StoredTranslationJob>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT id, source_language, target_language, input_text, status, stage, progress, queued_at, started_at, completed_at, failed_at, failure_reason, metadata, updated_at
             FROM translation_jobs
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

        rows.iter().map(|row| build_stored_job(row)).collect()
    }

    /// Returns historic job executions along with any captured outputs.
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
             ORDER BY j.queued_at DESC
             LIMIT ?1 OFFSET ?2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

        rows.into_iter().map(build_history_record).collect()
    }

    /// Fetches a single job with output snapshot if it exists.
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

    /// Deletes completed and failed jobs alongside their outputs.
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

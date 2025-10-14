//! Operations for the internal jobs ledger used to track background tasks.

use uuid::Uuid;

use crate::db::builders::build_job;
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{Job, JobState, JobType};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts a new background job row returning the hydrated representation.
    pub async fn insert_pipeline_job(
        &self,
        job_type: JobType,
        project_id: Uuid,
        state: JobState,
        file_target_id: Option<Uuid>,
        artifact_id: Option<Uuid>,
        error: Option<&str>,
        attempts: i64,
        job_key: &str,
    ) -> DbResult<Job> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let job_id = Uuid::new_v4();
        let now = now_iso8601();

        let started_at = match state {
            JobState::Running | JobState::Succeeded | JobState::Failed | JobState::Cancelled => {
                Some(now.clone())
            }
            JobState::Pending => None,
        };

        let finished_at = match state {
            JobState::Succeeded | JobState::Failed | JobState::Cancelled => Some(now.clone()),
            JobState::Pending | JobState::Running => None,
        };

        let row = sqlx::query(
            "INSERT INTO jobs (
                 job_id,
                 project_id,
                 job_type,
                 job_key,
                 file_target_id,
                 artifact_id,
                 state,
                 attempts,
                 error,
                 created_at,
                 started_at,
                 finished_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(job_key) DO UPDATE SET
                 state = excluded.state,
                 attempts = excluded.attempts,
                 error = excluded.error,
                 started_at = COALESCE(excluded.started_at, started_at),
                 finished_at = COALESCE(excluded.finished_at, finished_at)
             RETURNING job_id, project_id, job_type, job_key, file_target_id, artifact_id, state,
                       attempts, error, created_at, started_at, finished_at",
        )
        .bind(&job_id.to_string())
        .bind(&project_id.to_string())
        .bind(job_type.as_str())
        .bind(job_key)
        .bind(file_target_id.map(|id| id.to_string()))
        .bind(artifact_id.map(|id| id.to_string()))
        .bind(state.as_str())
        .bind(attempts)
        .bind(error)
        .bind(&now)
        .bind(started_at.as_deref())
        .bind(finished_at.as_deref())
        .fetch_one(&pool)
        .await?;

        build_job(&row)
    }

    /// Inserts a new job row returning only the generated job identifier (legacy helper).
    pub async fn insert_job_row(
        &self,
        job_type: &str,
        project_id: Uuid,
        state: &str,
        file_target_id: Option<Uuid>,
        artifact_id: Option<Uuid>,
        error: Option<&str>,
        attempts: i64,
        job_key: &str,
    ) -> DbResult<Uuid> {
        let job_type_enum = JobType::from_str(job_type)
            .ok_or_else(|| DbError::InvalidJobType(job_type.to_string()))?;
        let state_enum =
            JobState::from_str(state).ok_or_else(|| DbError::InvalidJobState(state.to_string()))?;

        let job = self
            .insert_pipeline_job(
                job_type_enum,
                project_id,
                state_enum,
                file_target_id,
                artifact_id,
                error,
                attempts,
                job_key,
            )
            .await?;

        Ok(job.job_id)
    }

    /// Retrieves a job by identifier.
    pub async fn get_job_by_id(&self, job_id: Uuid) -> DbResult<Option<Job>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT job_id, project_id, job_type, job_key, file_target_id, artifact_id, state,
                    attempts, error, created_at, started_at, finished_at
             FROM jobs
             WHERE job_id = ?1
             LIMIT 1",
        )
        .bind(&job_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let job = build_job(&row)?;
            return Ok(Some(job));
        }

        Ok(None)
    }

    /// Attempts to transition a job from `from_state` to `to_state`. Returns `true` if updated.
    pub async fn transition_job_state(
        &self,
        job_id: Uuid,
        from_state: JobState,
        to_state: JobState,
    ) -> DbResult<bool> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let (started_at, finished_at) = match to_state {
            JobState::Running => (Some(now.clone()), None),
            JobState::Succeeded | JobState::Failed | JobState::Cancelled => {
                (None, Some(now.clone()))
            }
            JobState::Pending => (None, None),
        };

        let result = sqlx::query(
            "UPDATE jobs
             SET state = ?1,
                 started_at = COALESCE(?2, started_at),
                 finished_at = COALESCE(?3, finished_at)
             WHERE job_id = ?4
               AND state = ?5",
        )
        .bind(to_state.as_str())
        .bind(started_at.as_deref())
        .bind(finished_at.as_deref())
        .bind(&job_id.to_string())
        .bind(from_state.as_str())
        .execute(&pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Marks a job as running and refreshes the `started_at` timestamp.
    pub async fn mark_job_started(&self, job_id: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let result = sqlx::query(
            "UPDATE jobs
             SET state = 'RUNNING',
                 started_at = ?1
             WHERE job_id = ?2",
        )
        .bind(&now)
        .bind(&job_id.to_string())
        .execute(&pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(job_id.to_string()));
        }

        Ok(())
    }

    /// Marks a job as finished with the provided terminal state and error message.
    pub async fn mark_job_finished(
        &self,
        job_id: Uuid,
        state: JobState,
        error: Option<&str>,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let result = sqlx::query(
            "UPDATE jobs
             SET state = ?1,
                 error = ?2,
                 finished_at = ?3
             WHERE job_id = ?4",
        )
        .bind(state.as_str())
        .bind(error)
        .bind(&now)
        .bind(&job_id.to_string())
        .execute(&pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(job_id.to_string()));
        }

        Ok(())
    }

    /// Lists pipeline jobs that require manual attention (pending or failed).
    pub async fn list_pipeline_jobs_needing_attention(&self) -> DbResult<Vec<Job>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT job_id, project_id, job_type, job_key, file_target_id, artifact_id, state,
                    attempts, error, created_at, started_at, finished_at
             FROM jobs
             WHERE state IN ('PENDING','FAILED')
             ORDER BY created_at ASC",
        )
        .fetch_all(&pool)
        .await?;

        let mut jobs = Vec::with_capacity(rows.len());
        for row in rows {
            jobs.push(build_job(&row)?);
        }

        Ok(jobs)
    }

    /// Increments the attempt counter for a job.
    pub async fn increment_job_attempts(&self, job_id: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;

        let result = sqlx::query(
            "UPDATE jobs
             SET attempts = attempts + 1
             WHERE job_id = ?1",
        )
        .bind(&job_id.to_string())
        .execute(&pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(job_id.to_string()));
        }

        Ok(())
    }
}

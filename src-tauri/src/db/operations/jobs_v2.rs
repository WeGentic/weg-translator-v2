//! Job operations for the refactored schema.

use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::db::types::{JobRecord, NewJobArgs, UpdateJobStatusArgs};

/// Inserts or replaces a job row.
pub async fn upsert_job(pool: &SqlitePool, args: NewJobArgs) -> DbResult<JobRecord> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO jobs (
            artifact_uuid,
            job_type,
            project_uuid,
            job_status,
            error_log
        )
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(artifact_uuid, job_type) DO UPDATE SET
            project_uuid = excluded.project_uuid,
            job_status = excluded.job_status,
            error_log = excluded.error_log
        "#,
    )
    .bind(args.artifact_uuid)
    .bind(&args.job_type)
    .bind(args.project_uuid)
    .bind(&args.job_status)
    .bind(&args.error_log)
    .execute(&mut *tx)
    .await?;

    let record = fetch_job(&mut tx, args.artifact_uuid, &args.job_type).await?;
    tx.commit().await?;
    record.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Updates job status and optional error log.
pub async fn update_job_status(
    pool: &SqlitePool,
    args: UpdateJobStatusArgs,
) -> DbResult<Option<JobRecord>> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE jobs
        SET job_status = ?3,
            error_log = ?4
        WHERE artifact_uuid = ?1
          AND job_type = ?2
        "#,
    )
    .bind(args.artifact_uuid)
    .bind(&args.job_type)
    .bind(&args.job_status)
    .bind(&args.error_log)
    .execute(&mut *tx)
    .await?;

    let record = fetch_job(&mut tx, args.artifact_uuid, &args.job_type).await?;
    tx.commit().await?;
    Ok(record)
}

/// Deletes a job entry.
pub async fn delete_job(pool: &SqlitePool, artifact_uuid: Uuid, job_type: &str) -> DbResult<()> {
    sqlx::query("DELETE FROM jobs WHERE artifact_uuid = ?1 AND job_type = ?2")
        .bind(artifact_uuid)
        .bind(job_type)
        .execute(pool)
        .await?;
    Ok(())
}

/// Lists jobs for a project.
pub async fn list_jobs_for_project(
    pool: &SqlitePool,
    project_uuid: Uuid,
) -> DbResult<Vec<JobRecord>> {
    let jobs: Vec<JobRecord> = sqlx::query_as("SELECT * FROM jobs WHERE project_uuid = ?1")
        .bind(project_uuid)
        .fetch_all(pool)
        .await?;
    Ok(jobs)
}

async fn fetch_job(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    artifact_uuid: Uuid,
    job_type: &str,
) -> DbResult<Option<JobRecord>> {
    let record = sqlx::query_as::<_, JobRecord>(
        "SELECT * FROM jobs WHERE artifact_uuid = ?1 AND job_type = ?2 LIMIT 1",
    )
    .bind(artifact_uuid)
    .bind(job_type)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(record)
}

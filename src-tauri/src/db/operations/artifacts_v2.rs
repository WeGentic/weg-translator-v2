//! Artifact operations for the refactored schema.

use sqlx::{SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::db::types::{ArtifactRecord, NewArtifactArgs, UpdateArtifactStatusArgs};

/// Inserts or replaces an artifact entry.
pub async fn upsert_artifact(pool: &SqlitePool, args: NewArtifactArgs) -> DbResult<ArtifactRecord> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO artifacts (
            artifact_uuid,
            project_uuid,
            file_uuid,
            artifact_type,
            size_bytes,
            segment_count,
            token_count,
            status
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(artifact_uuid) DO UPDATE SET
            project_uuid = excluded.project_uuid,
            file_uuid = excluded.file_uuid,
            artifact_type = excluded.artifact_type,
            size_bytes = excluded.size_bytes,
            segment_count = excluded.segment_count,
            token_count = excluded.token_count,
            status = excluded.status
        "#,
    )
    .bind(args.artifact_uuid)
    .bind(args.project_uuid)
    .bind(args.file_uuid)
    .bind(&args.artifact_type)
    .bind(args.size_bytes)
    .bind(args.segment_count)
    .bind(args.token_count)
    .bind(&args.status)
    .execute(&mut *tx)
    .await?;

    let record = fetch_artifact(&mut tx, args.artifact_uuid).await?;
    tx.commit().await?;

    record.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Updates artifact status-related fields.
pub async fn update_artifact_status(
    pool: &SqlitePool,
    args: UpdateArtifactStatusArgs,
) -> DbResult<Option<ArtifactRecord>> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE artifacts
        SET status = ?2,
            size_bytes = COALESCE(?3, size_bytes),
            segment_count = COALESCE(?4, segment_count),
            token_count = COALESCE(?5, token_count)
        WHERE artifact_uuid = ?1
        "#,
    )
    .bind(args.artifact_uuid)
    .bind(&args.status)
    .bind(args.size_bytes)
    .bind(args.segment_count)
    .bind(args.token_count)
    .execute(&mut *tx)
    .await?;

    let record = fetch_artifact(&mut tx, args.artifact_uuid).await?;
    tx.commit().await?;
    Ok(record)
}

/// Deletes an artifact.
pub async fn delete_artifact(pool: &SqlitePool, artifact_uuid: Uuid) -> DbResult<()> {
    sqlx::query("DELETE FROM artifacts WHERE artifact_uuid = ?1")
        .bind(artifact_uuid)
        .execute(pool)
        .await?;
    Ok(())
}

/// Lists artifacts for a specific project file.
pub async fn list_artifacts_for_file(
    pool: &SqlitePool,
    project_uuid: Uuid,
    file_uuid: Uuid,
) -> DbResult<Vec<ArtifactRecord>> {
    let artifacts: Vec<ArtifactRecord> =
        sqlx::query_as("SELECT * FROM artifacts WHERE project_uuid = ?1 AND file_uuid = ?2")
            .bind(project_uuid)
            .bind(file_uuid)
            .fetch_all(pool)
            .await?;
    Ok(artifacts)
}

async fn fetch_artifact(
    tx: &mut Transaction<'_, sqlx::Sqlite>,
    artifact_uuid: Uuid,
) -> DbResult<Option<ArtifactRecord>> {
    let record = sqlx::query_as::<_, ArtifactRecord>(
        "SELECT * FROM artifacts WHERE artifact_uuid = ?1 LIMIT 1",
    )
    .bind(artifact_uuid)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(record)
}

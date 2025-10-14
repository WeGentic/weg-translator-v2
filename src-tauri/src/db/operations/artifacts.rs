//! Operations for managing artifact records generated during project processing.

use uuid::Uuid;

use crate::db::builders::{build_artifact, build_file_target};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{Artifact, ArtifactKind, ArtifactStatus, FileTarget};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Fetches an artifact by identifier.
    pub async fn get_artifact_by_id(&self, artifact_id: Uuid) -> DbResult<Option<Artifact>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT artifact_id, file_target_id, kind, rel_path, size_bytes, checksum, tool, status,
                    created_at, updated_at
             FROM artifacts
             WHERE artifact_id = ?1
             LIMIT 1",
        )
        .bind(&artifact_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let artifact = build_artifact(&row)?;
            return Ok(Some(artifact));
        }

        Ok(None)
    }

    /// Lists artifacts for a given file target ordered by creation time.
    pub async fn list_artifacts_for_target(&self, file_target_id: Uuid) -> DbResult<Vec<Artifact>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT artifact_id, file_target_id, kind, rel_path, size_bytes, checksum, tool, status,
                    created_at, updated_at
             FROM artifacts
             WHERE file_target_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&file_target_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut artifacts = Vec::with_capacity(rows.len());
        for row in rows {
            artifacts.push(build_artifact(&row)?);
        }

        Ok(artifacts)
    }

    /// Fetches an artifact for a file target by its kind, if present.
    pub async fn find_artifact_by_kind(
        &self,
        file_target_id: Uuid,
        kind: ArtifactKind,
    ) -> DbResult<Option<Artifact>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT artifact_id, file_target_id, kind, rel_path, size_bytes, checksum, tool, status,
                    created_at, updated_at
             FROM artifacts
             WHERE file_target_id = ?1
               AND kind = ?2
             LIMIT 1",
        )
        .bind(&file_target_id.to_string())
        .bind(kind.as_str())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let artifact = build_artifact(&row)?;
            return Ok(Some(artifact));
        }

        Ok(None)
    }

    /// Inserts or updates an artifact row for the provided file target and kind.
    pub async fn upsert_artifact(
        &self,
        file_target_id: Uuid,
        kind: ArtifactKind,
        rel_path: &str,
        size_bytes: Option<i64>,
        checksum: Option<&str>,
        tool: Option<&str>,
        status: ArtifactStatus,
    ) -> DbResult<Artifact> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let artifact_id = Uuid::new_v4();
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO artifacts (
                 artifact_id,
                 file_target_id,
                 kind,
                 rel_path,
                 size_bytes,
                 checksum,
                 tool,
                 status,
                 created_at,
                 updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
             ON CONFLICT(file_target_id, kind) DO UPDATE SET
                 rel_path = excluded.rel_path,
                 size_bytes = excluded.size_bytes,
                 checksum = excluded.checksum,
                 tool = excluded.tool,
                 status = excluded.status,
                 updated_at = excluded.updated_at
             RETURNING artifact_id, file_target_id, kind, rel_path, size_bytes, checksum, tool, status,
                       created_at, updated_at",
        )
        .bind(&artifact_id.to_string())
        .bind(&file_target_id.to_string())
        .bind(kind.as_str())
        .bind(rel_path)
        .bind(size_bytes)
        .bind(checksum)
        .bind(tool)
        .bind(status.as_str())
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_artifact(&row)
    }

    /// Backwards compatible helper returning only the artifact identifier.
    pub async fn upsert_artifact_row(
        &self,
        file_target_id: Uuid,
        kind: &str,
        rel_path: &str,
        size_bytes: Option<i64>,
        checksum: Option<&str>,
        tool: Option<&str>,
        status: &str,
    ) -> DbResult<Uuid> {
        let kind_enum = ArtifactKind::from_str(kind)
            .ok_or_else(|| DbError::InvalidArtifactKind(kind.to_string()))?;
        let status_enum = ArtifactStatus::from_str(status)
            .ok_or_else(|| DbError::InvalidArtifactStatus(status.to_string()))?;

        let artifact = self
            .upsert_artifact(
                file_target_id,
                kind_enum,
                rel_path,
                size_bytes,
                checksum,
                tool,
                status_enum,
            )
            .await?;

        Ok(artifact.artifact_id)
    }

    /// Returns the file target associated with an artifact.
    pub async fn get_file_target_for_artifact(
        &self,
        artifact_id: Uuid,
    ) -> DbResult<Option<FileTarget>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT ft.file_target_id, ft.file_id, ft.pair_id, ft.status, ft.created_at, ft.updated_at
             FROM artifacts a
             INNER JOIN file_targets ft ON ft.file_target_id = a.file_target_id
             WHERE a.artifact_id = ?1
             LIMIT 1",
        )
        .bind(&artifact_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let target = build_file_target(&row)?;
            return Ok(Some(target));
        }

        Ok(None)
    }
}

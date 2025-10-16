//! Operations that interact with `file_targets` rows for the extraction pipeline.

use sqlx::Row;
use uuid::Uuid;

use crate::db::builders::{build_file_target, build_language_pair};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{FileTarget, FileTargetStatus, LanguagePair};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Attempts to resolve the file target for the provided file and language pair.
    pub async fn find_file_target(
        &self,
        project_id: Uuid,
        project_file_id: Uuid,
        src_lang: &str,
        tgt_lang: &str,
    ) -> DbResult<Option<Uuid>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT ft.file_target_id
             FROM file_targets ft
             INNER JOIN project_language_pairs lp
               ON lp.pair_id = ft.pair_id
             WHERE ft.file_id = ?1
               AND lp.project_id = ?2
               AND lp.src_lang = ?3 COLLATE NOCASE
               AND lp.trg_lang = ?4 COLLATE NOCASE
             LIMIT 1",
        )
        .bind(&project_file_id.to_string())
        .bind(&project_id.to_string())
        .bind(src_lang)
        .bind(tgt_lang)
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let id_str: String = row.try_get("file_target_id")?;
            let file_target_id =
                Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidUuid(id_str.clone()))?;
            return Ok(Some(file_target_id));
        }

        Ok(None)
    }

    /// Fetches a specific file target by identifier.
    pub async fn get_file_target_by_id(
        &self,
        file_target_id: Uuid,
    ) -> DbResult<Option<FileTarget>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_target_id = ?1
             LIMIT 1",
        )
        .bind(&file_target_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let file_target = build_file_target(&row)?;
            return Ok(Some(file_target));
        }

        Ok(None)
    }

    /// Retrieves the language pair associated with the provided identifier.
    pub async fn get_language_pair_by_id(&self, pair_id: Uuid) -> DbResult<Option<LanguagePair>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT pair_id, project_id, src_lang, trg_lang, created_at
             FROM project_language_pairs
             WHERE pair_id = ?1
             LIMIT 1",
        )
        .bind(&pair_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let pair = build_language_pair(&row)?;
            return Ok(Some(pair));
        }

        Ok(None)
    }

    /// Lists file targets associated with a project file.
    pub async fn list_file_targets_for_file(
        &self,
        project_file_id: Uuid,
    ) -> DbResult<Vec<FileTarget>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&project_file_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut targets = Vec::with_capacity(rows.len());
        for row in rows {
            targets.push(build_file_target(&row)?);
        }

        Ok(targets)
    }

    /// Inserts a new file target row and returns the hydrated representation.
    pub async fn insert_file_target(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<FileTarget> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let file_target_id = Uuid::new_v4();
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO file_targets (
                 file_target_id,
                 file_id,
                 pair_id,
                 status,
                 created_at,
                 updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             RETURNING file_target_id, file_id, pair_id, status, created_at, updated_at",
        )
        .bind(&file_target_id.to_string())
        .bind(&file_id.to_string())
        .bind(&pair_id.to_string())
        .bind(status.as_str())
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_file_target(&row)
    }

    /// Ensures a file target exists for the provided file and language pair.
    pub async fn ensure_file_target(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<FileTarget> {
        if let Some(existing) = self
            .get_file_target_by_file_and_pair(file_id, pair_id)
            .await?
        {
            return Ok(existing);
        }

        self.insert_file_target(file_id, pair_id, status).await
    }

    /// Updates a file target status while refreshing its `updated_at` timestamp.
    pub async fn update_file_target_status(
        &self,
        file_target_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let result = sqlx::query(
            "UPDATE file_targets
             SET status = ?1,
                 updated_at = ?2
             WHERE file_target_id = ?3",
        )
        .bind(status.as_str())
        .bind(&now)
        .bind(&file_target_id.to_string())
        .execute(&pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(file_target_id.to_string()));
        }

        Ok(())
    }

    /// Retrieves a file target using the composite key (file_id, pair_id).
    pub async fn get_file_target_by_file_and_pair(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
    ) -> DbResult<Option<FileTarget>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_id = ?1
               AND pair_id = ?2
             LIMIT 1",
        )
        .bind(&file_id.to_string())
        .bind(&pair_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let target = build_file_target(&row)?;
            return Ok(Some(target));
        }

        Ok(None)
    }
}

//! Operations for managing project-specific language pairs.

use uuid::Uuid;

use crate::db::builders::build_language_pair;
use crate::db::error::DbResult;
use crate::db::manager::DbManager;
use crate::db::types::LanguagePair;
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Lists all language pairs registered for a project.
    pub async fn list_language_pairs_for_project(
        &self,
        project_id: Uuid,
    ) -> DbResult<Vec<LanguagePair>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT pair_id, project_id, src_lang, trg_lang, created_at
             FROM project_language_pairs
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&project_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut pairs = Vec::with_capacity(rows.len());
        for row in rows {
            pairs.push(build_language_pair(&row)?);
        }

        Ok(pairs)
    }

    /// Finds a specific language pair given its identifier.
    pub async fn find_language_pair_by_id(&self, pair_id: Uuid) -> DbResult<Option<LanguagePair>> {
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

    /// Attempts to resolve a language pair by project and language codes.
    pub async fn find_language_pair(
        &self,
        project_id: Uuid,
        src_lang: &str,
        trg_lang: &str,
    ) -> DbResult<Option<LanguagePair>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT pair_id, project_id, src_lang, trg_lang, created_at
             FROM project_language_pairs
             WHERE project_id = ?1
               AND src_lang = ?2 COLLATE NOCASE
               AND trg_lang = ?3 COLLATE NOCASE
             LIMIT 1",
        )
        .bind(&project_id.to_string())
        .bind(src_lang)
        .bind(trg_lang)
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let pair = build_language_pair(&row)?;
            return Ok(Some(pair));
        }

        Ok(None)
    }

    /// Inserts a new language pair row for a project.
    pub async fn insert_language_pair(
        &self,
        project_id: Uuid,
        src_lang: &str,
        trg_lang: &str,
    ) -> DbResult<LanguagePair> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let pair_id = Uuid::new_v4();
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO project_language_pairs (
                 pair_id,
                 project_id,
                 src_lang,
                 trg_lang,
                 created_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING pair_id, project_id, src_lang, trg_lang, created_at",
        )
        .bind(&pair_id.to_string())
        .bind(&project_id.to_string())
        .bind(src_lang.trim())
        .bind(trg_lang.trim())
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_language_pair(&row)
    }

    /// Ensures a language pair exists, returning the hydrated row.
    pub async fn ensure_language_pair(
        &self,
        project_id: Uuid,
        src_lang: &str,
        trg_lang: &str,
    ) -> DbResult<LanguagePair> {
        if let Some(existing) = self
            .find_language_pair(project_id, src_lang, trg_lang)
            .await?
        {
            return Ok(existing);
        }

        self.insert_language_pair(project_id, src_lang, trg_lang)
            .await
    }
}

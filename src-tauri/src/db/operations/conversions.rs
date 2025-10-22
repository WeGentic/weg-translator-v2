//! Project file conversion helpers and status management.

use log::debug;
use sqlx::{Executor, Row, Sqlite, Transaction};
use uuid::Uuid;

use crate::db::builders::{build_project_file_conversion, conversion_projection};
use crate::db::constants::{CONVERTIBLE_EXTENSIONS, SKIP_CONVERSION_EXTENSIONS};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{
    NewProjectFileConversion, ProjectFileConversionRequest, ProjectFileConversionRow,
    ProjectFileConversionStatus, ProjectFileImportStatus,
};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts one or more conversion rows within an existing transaction.
    pub(crate) async fn insert_project_file_conversions(
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

    /// Updates conversion status fields and associated artifact paths.
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

    /// Returns an existing conversion that matches the request or creates a new one.
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

    /// Internal helper that reuses an open transaction for conversion lookup/insertion.
    async fn find_or_create_conversion_for_file_tx(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        project_file_id: Uuid,
        request: &ProjectFileConversionRequest,
    ) -> DbResult<ProjectFileConversionRow> {
        let file_id = project_file_id.to_string();
        let columns = conversion_projection();
        let select_existing = format!(
            "SELECT {columns} FROM project_file_conversions
             WHERE project_file_id = ?1
               AND src_lang = ?2
               AND tgt_lang = ?3
               AND version = ?4
             LIMIT 1",
            columns = columns,
        );

        if let Some(row) = sqlx::query(&select_existing)
            .bind(&file_id)
            .bind(&request.src_lang)
            .bind(&request.tgt_lang)
            .bind(&request.version)
            .fetch_optional(tx.as_mut())
            .await?
        {
            let mut conversion = build_project_file_conversion(&row)?;

            if conversion.paragraph != request.paragraph || conversion.embed != request.embed {
                let paragraph_flag = if request.paragraph { 1 } else { 0 };
                let embed_flag = if request.embed { 1 } else { 0 };
                sqlx::query(
                    "UPDATE project_file_conversions
                     SET paragraph = ?1,
                         embed = ?2,
                         updated_at = ?3
                     WHERE id = ?4",
                )
                .bind(paragraph_flag)
                .bind(embed_flag)
                .bind(now_iso8601())
                .bind(&conversion.id.to_string())
                .execute(tx.as_mut())
                .await?;

                conversion.paragraph = request.paragraph;
                conversion.embed = request.embed;
            }

            return Ok(conversion);
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

        if let Err(err) = self
            .insert_project_file_conversions(std::slice::from_ref(&new_conversion), tx)
            .await
        {
            if let DbError::ConstraintViolation(message) = &err {
                if message.contains("UNIQUE constraint failed") {
                    let select_existing = format!(
                        "SELECT {columns} FROM project_file_conversions
                         WHERE project_file_id = ?1
                           AND src_lang = ?2
                           AND tgt_lang = ?3
                           AND version = ?4
                         LIMIT 1",
                        columns = columns,
                    );

                    let existing = sqlx::query(&select_existing)
                        .bind(&file_id)
                        .bind(&request.src_lang)
                        .bind(&request.tgt_lang)
                        .bind(&request.version)
                        .fetch_one(tx.as_mut())
                        .await?;

                    return build_project_file_conversion(&existing);
                }
            }

            return Err(err);
        }

        let select_inserted = format!(
            "SELECT {columns} FROM project_file_conversions WHERE id = ?1",
            columns = columns,
        );

        let inserted_row = sqlx::query(&select_inserted)
            .bind(&conversion_id.to_string())
            .fetch_one(tx.as_mut())
            .await?;

        build_project_file_conversion(&inserted_row)
    }

    /// Fetches the conversion row along with the owning project identifier.
    pub async fn load_conversion_with_project(
        &self,
        conversion_id: Uuid,
    ) -> DbResult<(ProjectFileConversionRow, Uuid)> {
        let pool = self.pool().await;
        let columns = conversion_projection();
        let prefixed_columns = columns
            .split(',')
            .map(|column| format!("c.{}", column.trim()))
            .collect::<Vec<_>>()
            .join(", ");
        let select_query = format!(
            "SELECT {columns}, pf.project_id AS project_id
             FROM project_file_conversions c
             INNER JOIN project_files pf ON pf.id = c.project_file_id
             WHERE c.id = ?1
             LIMIT 1",
            columns = prefixed_columns
        );

        let row = sqlx::query(&select_query)
            .bind(&conversion_id.to_string())
            .fetch_optional(&pool)
            .await?;

        let row = match row {
            Some(record) => record,
            None => return Err(DbError::ProjectFileConversionNotFound(conversion_id)),
        };

        let project_id_raw: String = row.try_get("project_id")?;
        let project_id = Uuid::parse_str(&project_id_raw)
            .map_err(|_| DbError::InvalidProjectId(project_id_raw.clone()))?;
        let conversion = build_project_file_conversion(&row)?;

        Ok((conversion, project_id))
    }

    /// Returns conversions that still require processing for the provided language pair.
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
}

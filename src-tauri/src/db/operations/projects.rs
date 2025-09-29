//! Project level CRUD and aggregation queries.

use std::path::{Path, PathBuf};

use log::debug;
use sqlx::{Executor, Row, Sqlite, Transaction};
use uuid::Uuid;

use crate::db::builders::{
    build_project_file_details, build_project_file_with_conversions, build_project_list_item,
    conversion_projection,
};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{NewProject, NewProjectFile, ProjectDetails, ProjectListItem};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts a project alongside any initial file rows within a single transaction.
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

    /// Inserts a single project row using the supplied transaction.
    pub(crate) async fn insert_project(
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
            "INSERT INTO projects (id, name, slug, project_type, root_path, status, default_src_lang, default_tgt_lang, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10)",
        )
        .bind(&id)
        .bind(&project.name)
        .bind(&project.slug)
        .bind(project.project_type.as_str())
        .bind(&project.root_path)
        .bind(project.status.as_str())
        .bind(project.default_src_lang.as_deref())
        .bind(project.default_tgt_lang.as_deref())
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

    /// Returns a paginated list of projects with aggregate conversion status.
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
                 COALESCE(COUNT(DISTINCT f.id), 0) AS file_count,
                 CASE
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'running' THEN 1 ELSE 0 END), 0) > 0 THEN 'running'
                   WHEN COALESCE(COUNT(c.id), 0) = 0 THEN 'pending'
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END), 0) > 0 THEN 'pending'
                   WHEN COALESCE(SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END), 0) = COALESCE(COUNT(c.id), 0) AND COALESCE(COUNT(c.id), 0) > 0 THEN 'completed'
                   ELSE 'failed'
                 END AS activity_status
             FROM projects p
             LEFT JOIN project_files f ON f.project_id = p.id
             LEFT JOIN project_file_conversions c ON c.project_file_id = f.id
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

    /// Loads a project with its files and conversion records.
    pub async fn list_project_details(&self, project_id: Uuid) -> DbResult<ProjectDetails> {
        let pool = self.pool().await;
        let project_id_str = project_id.to_string();

        let select_project = sqlx::query(
            "SELECT id, name, slug, default_src_lang, default_tgt_lang, root_path
             FROM projects WHERE id = ?1",
        )
        .bind(&project_id_str)
        .fetch_optional(&pool)
        .await?;

        let project_row = match select_project {
            Some(row) => row,
            None => return Err(DbError::ProjectNotFound(project_id)),
        };

        let name: String = project_row.try_get("name")?;
        let slug: String = project_row.try_get("slug")?;
        let default_src_lang: Option<String> = project_row.try_get("default_src_lang")?;
        let default_tgt_lang: Option<String> = project_row.try_get("default_tgt_lang")?;
        let root_path: String = project_row.try_get("root_path")?;

        let file_rows = sqlx::query(
            "SELECT id, original_name, stored_rel_path, ext, size_bytes, import_status, created_at, updated_at
             FROM project_files
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&project_id_str)
        .fetch_all(&pool)
        .await?;

        let mut files = Vec::with_capacity(file_rows.len());

        for row in file_rows {
            let details = build_project_file_details(&row)?;
            let select_conversions = format!(
                "SELECT {columns} FROM project_file_conversions
                 WHERE project_file_id = ?1
                 ORDER BY created_at ASC",
                columns = conversion_projection(),
            );

            let conversion_rows = sqlx::query(&select_conversions)
                .bind(&details.id.to_string())
                .fetch_all(&pool)
                .await?;

            files.push(build_project_file_with_conversions(
                details,
                conversion_rows,
            )?);
        }

        Ok(ProjectDetails {
            id: project_id,
            name,
            slug,
            default_src_lang,
            default_tgt_lang,
            root_path,
            files,
        })
    }

    /// Fetches the persisted root path for a project.
    pub async fn project_root_path(&self, project_id: Uuid) -> DbResult<PathBuf> {
        let pool = self.pool().await;
        let project_row = sqlx::query("SELECT root_path FROM projects WHERE id = ?1")
            .bind(&project_id.to_string())
            .fetch_optional(&pool)
            .await?;

        match project_row {
            Some(row) => {
                let root: String = row.try_get("root_path")?;
                Ok(PathBuf::from(root))
            }
            None => Err(DbError::ProjectNotFound(project_id)),
        }
    }

    /// Deletes a project row and returns the number of affected records.
    pub async fn delete_project(&self, project_id: Uuid) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let deleted = sqlx::query("DELETE FROM projects WHERE id = ?1")
            .bind(&project_id.to_string())
            .execute(tx.as_mut())
            .await?;

        tx.commit().await?;

        Ok(deleted.rows_affected())
    }

    /// Rewrites stored project root paths when the application base directory changes.
    pub async fn update_project_root_paths(
        &self,
        old_base: &Path,
        new_base: &Path,
    ) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let projects = sqlx::query("SELECT id, root_path FROM projects")
            .fetch_all(&mut *tx)
            .await?;

        let mut updated = 0u64;
        let now = now_iso8601();

        for row in projects {
            let id: String = row.try_get("id")?;
            let root_path: String = row.try_get("root_path")?;
            let current_path = PathBuf::from(&root_path);

            if let Ok(relative) = current_path.strip_prefix(old_base) {
                let candidate = new_base.join(relative);
                if candidate != current_path {
                    let candidate_str = candidate.to_string_lossy().to_string();
                    let result = sqlx::query(
                        "UPDATE projects SET root_path = ?1, updated_at = ?2 WHERE id = ?3",
                    )
                    .bind(&candidate_str)
                    .bind(&now)
                    .bind(&id)
                    .execute(&mut *tx)
                    .await?;

                    updated += result.rows_affected();
                }
            }
        }

        tx.commit().await?;

        if updated > 0 {
            debug!(
                target: "db::projects",
                "updated root paths for {updated} project(s) after storage migration"
            );
        }

        Ok(updated)
    }
}

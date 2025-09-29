//! Operations that manage project files and related metadata.

use std::fs;
use std::path::Path;

use log::debug;
use sqlx::{Executor, Sqlite, Transaction};
use uuid::Uuid;

use crate::db::builders::build_project_file_details;
use crate::db::error::DbResult;
use crate::db::manager::DbManager;
use crate::db::types::{NewProjectFile, ProjectFileDetails};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts a project file row using the provided transaction.
    pub(crate) async fn insert_project_file(
        &self,
        file: &NewProjectFile,
        tx: &mut Transaction<'_, Sqlite>,
    ) -> DbResult<()> {
        let now = now_iso8601();
        let id = file.id.to_string();
        let project_id = file.project_id.to_string();

        let query = sqlx::query(
            "INSERT INTO project_files (id, project_id, original_name, original_path, stored_rel_path, ext, size_bytes, checksum_sha256, import_status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        )
        .bind(&id)
        .bind(&project_id)
        .bind(&file.original_name)
        .bind(&file.original_path)
        .bind(&file.stored_rel_path)
        .bind(&file.ext)
        .bind(file.size_bytes)
        .bind(file.checksum_sha256.as_deref())
        .bind(file.import_status.as_str())
        .bind(&now);

        tx.execute(query).await?;

        debug!(
            target: "db::project_files",
            "inserted project file {id} for project {project_id} ({original})",
            original = file.original_name
        );

        Ok(())
    }

    /// Adds files to an existing project and returns the hydrated file metadata.
    pub async fn add_files_to_project(
        &self,
        project_id: Uuid,
        new_files: &[NewProjectFile],
    ) -> DbResult<Vec<ProjectFileDetails>> {
        if new_files.is_empty() {
            return Ok(Vec::new());
        }

        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        for file in new_files {
            self.insert_project_file(file, &mut tx).await?;
        }

        let mut inserted = Vec::with_capacity(new_files.len());
        for file in new_files {
            let row = sqlx::query(
                "SELECT id, original_name, stored_rel_path, ext, size_bytes, import_status, created_at, updated_at
                 FROM project_files WHERE id = ?1 AND project_id = ?2",
            )
            .bind(&file.id.to_string())
            .bind(&project_id.to_string())
            .fetch_one(tx.as_mut())
            .await?;

            inserted.push(build_project_file_details(&row)?);
        }

        tx.commit().await?;

        Ok(inserted)
    }

    /// Removes a file from a project by identifier.
    pub async fn remove_project_file(
        &self,
        project_id: Uuid,
        project_file_id: Uuid,
    ) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let mut tx = pool.begin().await?;

        let removed = sqlx::query("DELETE FROM project_files WHERE id = ?1 AND project_id = ?2")
            .bind(&project_file_id.to_string())
            .bind(&project_id.to_string())
            .execute(tx.as_mut())
            .await?;

        tx.commit().await?;

        Ok(removed.rows_affected())
    }

    /// Ensures a named subdirectory exists below the provided root.
    pub fn ensure_subdir(root: &Path, name: &str) -> DbResult<std::path::PathBuf> {
        let target = root.join(name);
        fs::create_dir_all(&target)?;
        Ok(target)
    }
}

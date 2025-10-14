//! Operations that manage project files and related metadata.

use std::fs;
use std::path::{Component, Path};

use log::debug;
use sqlx::{Executor, Sqlite, Transaction};
use uuid::Uuid;

use crate::db::builders::build_project_file_details;
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{NewProjectFile, ProjectFileDetails, ProjectFileStorageState};
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
            "INSERT INTO project_files (
                 id,
                 project_id,
                 original_name,
                 original_path,
                 stored_rel_path,
                 ext,
                 size_bytes,
                 checksum_sha256,
                 import_status,
                 role,
                 mime_type,
                 hash_sha256,
                 storage_state,
                 importer,
                 created_at,
                 updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
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
        .bind(file.role.as_str())
        .bind(file.mime_type.as_deref())
        .bind(file.hash_sha256.as_deref())
        .bind(file.storage_state.as_str())
        .bind(file.importer.as_deref())
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
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(DbError::InvalidSubdirectory(name.to_string()));
        }

        let candidate = Path::new(trimmed);
        let mut components = candidate.components();

        match components.next() {
            Some(Component::Normal(_)) => {}
            _ => {
                return Err(DbError::InvalidSubdirectory(name.to_string()));
            }
        }

        if components.next().is_some() {
            return Err(DbError::InvalidSubdirectory(name.to_string()));
        }

        let target = root.join(candidate);
        fs::create_dir_all(&target)?;
        Ok(target)
    }

    /// Updates staged file metadata after the filesystem copy completes.
    pub async fn update_project_file_staging_metadata(
        &self,
        file_id: Uuid,
        size_bytes: i64,
        hash_sha256: &str,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        sqlx::query(
            "UPDATE project_files
             SET size_bytes = ?1,
                 hash_sha256 = ?2,
                 storage_state = ?3,
                 updated_at = ?4
             WHERE id = ?5",
        )
        .bind(size_bytes)
        .bind(hash_sha256)
        .bind(ProjectFileStorageState::Staged.as_str())
        .bind(&now)
        .bind(&file_id.to_string())
        .execute(&pool)
        .await?;

        Ok(())
    }

    /// Finalises staged files by promoting their stored paths and storage state.
    pub async fn finalize_staged_project_files(&self, project_id: Uuid) -> DbResult<u64> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let result = sqlx::query(
            "UPDATE project_files
             SET stored_rel_path = REPLACE(stored_rel_path, '.staging/', ''),
                 storage_state = ?1,
                 updated_at = ?2
             WHERE project_id = ?3 AND storage_state = ?4",
        )
        .bind(ProjectFileStorageState::Copied.as_str())
        .bind(&now)
        .bind(&project_id.to_string())
        .bind(ProjectFileStorageState::Staged.as_str())
        .execute(&pool)
        .await?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::error::DbError;
    use tempfile::tempdir;

    #[test]
    fn ensure_subdir_allows_simple_names() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        let dir = DbManager::ensure_subdir(root, "artifacts").expect("create artifacts dir");
        assert!(dir.exists());
        assert!(dir.starts_with(root));
    }

    #[test]
    fn ensure_subdir_rejects_traversal_components() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        let err = DbManager::ensure_subdir(root, "../evil").unwrap_err();
        assert!(matches!(err, DbError::InvalidSubdirectory(_)));
    }

    #[test]
    fn ensure_subdir_rejects_nested_segments() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        let err = DbManager::ensure_subdir(root, "lang/en-US").unwrap_err();
        assert!(matches!(err, DbError::InvalidSubdirectory(_)));
    }
}

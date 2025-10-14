//! Operations for managing project notes.

use uuid::Uuid;

use crate::db::builders::build_note;
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::Note;
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts a note for the specified project.
    pub async fn insert_note(
        &self,
        project_id: Uuid,
        author_user_id: &str,
        body: &str,
    ) -> DbResult<Note> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let note_id = Uuid::new_v4();
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO notes (
                 note_id,
                 project_id,
                 author_user_id,
                 body,
                 created_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING note_id, project_id, author_user_id, body, created_at",
        )
        .bind(&note_id.to_string())
        .bind(&project_id.to_string())
        .bind(author_user_id)
        .bind(body)
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_note(&row)
    }

    /// Lists notes for a project ordered from newest to oldest.
    pub async fn list_notes_for_project(&self, project_id: Uuid) -> DbResult<Vec<Note>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT note_id, project_id, author_user_id, body, created_at
             FROM notes
             WHERE project_id = ?1
             ORDER BY created_at DESC",
        )
        .bind(&project_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut notes = Vec::with_capacity(rows.len());
        for row in rows {
            notes.push(build_note(&row)?);
        }

        Ok(notes)
    }

    /// Deletes a note by identifier.
    pub async fn delete_note(&self, note_id: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;

        let result = sqlx::query("DELETE FROM notes WHERE note_id = ?1")
            .bind(&note_id.to_string())
            .execute(&pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(note_id.to_string()));
        }

        Ok(())
    }
}

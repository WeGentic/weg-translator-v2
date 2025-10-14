#![allow(dead_code)]

//! Project note types authored by users within the workspace.

use uuid::Uuid;

/// Free-form note associated with a project for collaboration context.
#[derive(Debug, Clone)]
pub struct Note {
    pub note_id: Uuid,
    pub project_id: Uuid,
    pub author_user_id: String,
    pub body: String,
    pub created_at: String,
}

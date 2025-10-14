#![allow(dead_code)]

//! Language pair types that associate projects with supported translations.

use uuid::Uuid;

/// Represents a project-specific language direction.
#[derive(Debug, Clone)]
pub struct LanguagePair {
    pub pair_id: Uuid,
    pub project_id: Uuid,
    pub src_lang: String,
    pub trg_lang: String,
    pub created_at: String,
}

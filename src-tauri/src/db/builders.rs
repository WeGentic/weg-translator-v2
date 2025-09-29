//! Helper builders that map SQL rows into strongly typed domain models.

use serde_json::Value;
use sqlx::{Row, sqlite::SqliteRow};
use uuid::Uuid;

use crate::ipc::dto::{
    StoredTranslationJob, TranslationHistoryRecord, TranslationOutputSnapshot, TranslationStage,
};

use super::constants::PROJECT_FILE_CONVERSION_COLUMNS;
use super::error::{DbError, DbResult};
use super::types::{
    ProjectFileConversionRow, ProjectFileConversionStatus, ProjectFileDetails,
    ProjectFileImportStatus, ProjectFileWithConversions, ProjectListItem, ProjectStatus,
    ProjectType,
};

/// Builds a stored job from a database row.
pub fn build_stored_job(row: &SqliteRow) -> DbResult<StoredTranslationJob> {
    let stage_str: String = row.try_get("stage")?;
    let stage = TranslationStage::from_db_value(&stage_str)
        .ok_or_else(|| DbError::InvalidStage(stage_str.clone()))?;

    let metadata: Option<String> = row.try_get("metadata")?;
    let metadata = match metadata {
        Some(raw) => Some(serde_json::from_str::<Value>(&raw)?),
        None => None,
    };

    let id_str: String = row.try_get("id")?;
    let job_id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidUuid(id_str.clone()))?;

    Ok(StoredTranslationJob {
        job_id,
        source_language: row.try_get("source_language")?,
        target_language: row.try_get("target_language")?,
        input_text: row.try_get("input_text")?,
        status: row.try_get("status")?,
        stage,
        progress: row.try_get("progress")?,
        queued_at: row.try_get("queued_at")?,
        started_at: row.try_get("started_at")?,
        completed_at: row.try_get("completed_at")?,
        failed_at: row.try_get("failed_at")?,
        failure_reason: row.try_get("failure_reason")?,
        metadata,
        updated_at: row.try_get("updated_at")?,
    })
}

/// Expands a joined history row into a full [`TranslationHistoryRecord`].
pub fn build_history_record(row: SqliteRow) -> DbResult<TranslationHistoryRecord> {
    let job = build_stored_job(&row)?;

    let output_text: Option<String> = row.try_get("output_text")?;
    let output_created_at: Option<String> = row.try_get("output_created_at")?;
    let output_updated_at: Option<String> = row.try_get("output_updated_at")?;

    let output = output_text.map(|text| TranslationOutputSnapshot {
        output_text: text,
        model_name: row.try_get("model_name").ok(),
        input_token_count: row.try_get("input_token_count").ok(),
        output_token_count: row.try_get("output_token_count").ok(),
        total_token_count: row.try_get("total_token_count").ok(),
        duration_ms: row.try_get("duration_ms").ok(),
        created_at: output_created_at.clone().unwrap_or_default(),
        updated_at: output_updated_at.clone().unwrap_or_default(),
    });

    Ok(TranslationHistoryRecord { job, output })
}

/// Hydrates a project list item from an aggregate query.
pub fn build_project_list_item(row: SqliteRow) -> DbResult<ProjectListItem> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let project_type_raw: String = row.try_get("project_type")?;
    let project_type = ProjectType::from_str(&project_type_raw)
        .ok_or_else(|| DbError::InvalidProjectType(project_type_raw.clone()))?;

    let status_raw: String = row.try_get("status")?;
    let status = ProjectStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidProjectStatus(status_raw.clone()))?;

    Ok(ProjectListItem {
        id,
        name: row.try_get("name")?,
        slug: row.try_get("slug")?,
        project_type,
        root_path: row.try_get("root_path")?,
        status,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        file_count: row.try_get("file_count")?,
        activity_status: row.try_get("activity_status")?,
    })
}

/// Maps a project file row into [`ProjectFileDetails`].
pub fn build_project_file_details(row: &SqliteRow) -> DbResult<ProjectFileDetails> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let import_status_raw: String = row.try_get("import_status")?;
    let import_status = ProjectFileImportStatus::from_str(&import_status_raw)
        .ok_or_else(|| DbError::InvalidProjectFileStatus(import_status_raw.clone()))?;

    Ok(ProjectFileDetails {
        id,
        original_name: row.try_get("original_name")?,
        stored_rel_path: row.try_get("stored_rel_path")?,
        ext: row.try_get("ext")?,
        size_bytes: row.try_get("size_bytes")?,
        import_status,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

/// Converts a conversion row into a strongly typed value.
pub fn build_project_file_conversion(row: &SqliteRow) -> DbResult<ProjectFileConversionRow> {
    let id_str: String = row.try_get("id")?;
    let id = Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidProjectId(id_str.clone()))?;

    let file_id_raw: String = row.try_get("project_file_id")?;
    let project_file_id = Uuid::parse_str(&file_id_raw)
        .map_err(|_| DbError::InvalidProjectId(file_id_raw.clone()))?;

    let status_raw: String = row.try_get("status")?;
    let status = ProjectFileConversionStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidProjectFileConversionStatus(status_raw.clone()))?;

    let paragraph_value: i64 = row.try_get("paragraph")?;
    let embed_value: i64 = row.try_get("embed")?;

    Ok(ProjectFileConversionRow {
        id,
        project_file_id,
        src_lang: row.try_get("src_lang")?,
        tgt_lang: row.try_get("tgt_lang")?,
        version: row.try_get("version")?,
        paragraph: paragraph_value != 0,
        embed: embed_value != 0,
        xliff_rel_path: row.try_get("xliff_rel_path")?,
        jliff_rel_path: row.try_get("jliff_rel_path")?,
        tag_map_rel_path: row.try_get("tag_map_rel_path")?,
        status,
        started_at: row.try_get("started_at")?,
        completed_at: row.try_get("completed_at")?,
        failed_at: row.try_get("failed_at")?,
        error_message: row.try_get("error_message")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

/// Collects file conversions for a project file and returns the wrapped representation.
pub fn build_project_file_with_conversions(
    details: ProjectFileDetails,
    conversion_rows: Vec<SqliteRow>,
) -> DbResult<ProjectFileWithConversions> {
    let mut conversions = Vec::with_capacity(conversion_rows.len());
    for conversion_row in conversion_rows {
        conversions.push(build_project_file_conversion(&conversion_row)?);
    }

    Ok(ProjectFileWithConversions {
        file: details,
        conversions,
    })
}

/// Returns a SELECT projection suitable for fetching conversion rows.
pub fn conversion_projection() -> &'static str {
    PROJECT_FILE_CONVERSION_COLUMNS
}

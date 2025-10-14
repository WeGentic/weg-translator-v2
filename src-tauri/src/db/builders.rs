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
    Artifact, ArtifactKind, ArtifactStatus, Client, Domain, FileTarget, FileTargetStatus, Job,
    JobState, JobType, LanguagePair, Note, ProjectFileConversionRow, ProjectFileConversionStatus,
    ProjectFileDetails, ProjectFileImportStatus, ProjectFileWithConversions, ProjectListItem,
    ProjectStatus, ProjectType, User, Validation,
};

/// Maps a reference user row into a strongly typed value.
#[allow(dead_code)]
pub fn build_user(row: &SqliteRow) -> DbResult<User> {
    Ok(User {
        user_id: row.try_get("user_id")?,
        email: row.try_get("email")?,
        display_name: row.try_get("display_name")?,
        created_at: row.try_get("created_at")?,
    })
}

/// Maps a client reference row into [`Client`].
#[allow(dead_code)]
pub fn build_client(row: &SqliteRow) -> DbResult<Client> {
    Ok(Client {
        client_id: row.try_get("client_id")?,
        name: row.try_get("name")?,
    })
}

/// Maps a domain reference row into [`Domain`].
#[allow(dead_code)]
pub fn build_domain(row: &SqliteRow) -> DbResult<Domain> {
    Ok(Domain {
        domain_id: row.try_get("domain_id")?,
        name: row.try_get("name")?,
    })
}

/// Hydrates a language pair row for a project.
#[allow(dead_code)]
pub fn build_language_pair(row: &SqliteRow) -> DbResult<LanguagePair> {
    let pair_id_raw: String = row.try_get("pair_id")?;
    let project_id_raw: String = row.try_get("project_id")?;

    let pair_id =
        Uuid::parse_str(&pair_id_raw).map_err(|_| DbError::InvalidUuid(pair_id_raw.clone()))?;
    let project_id = Uuid::parse_str(&project_id_raw)
        .map_err(|_| DbError::InvalidProjectId(project_id_raw.clone()))?;

    Ok(LanguagePair {
        pair_id,
        project_id,
        src_lang: row.try_get("src_lang")?,
        trg_lang: row.try_get("trg_lang")?,
        created_at: row.try_get("created_at")?,
    })
}

/// Hydrates a file target row for downstream processing.
#[allow(dead_code)]
pub fn build_file_target(row: &SqliteRow) -> DbResult<FileTarget> {
    let file_target_id_raw: String = row.try_get("file_target_id")?;
    let file_id_raw: String = row.try_get("file_id")?;
    let pair_id_raw: String = row.try_get("pair_id")?;
    let status_raw: String = row.try_get("status")?;

    let file_target_id = Uuid::parse_str(&file_target_id_raw)
        .map_err(|_| DbError::InvalidUuid(file_target_id_raw.clone()))?;
    let file_id =
        Uuid::parse_str(&file_id_raw).map_err(|_| DbError::InvalidUuid(file_id_raw.clone()))?;
    let pair_id =
        Uuid::parse_str(&pair_id_raw).map_err(|_| DbError::InvalidUuid(pair_id_raw.clone()))?;

    let status = FileTargetStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidFileTargetStatus(status_raw.clone()))?;

    Ok(FileTarget {
        file_target_id,
        file_id,
        pair_id,
        status,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

/// Hydrates an artifact row for a file target.
#[allow(dead_code)]
pub fn build_artifact(row: &SqliteRow) -> DbResult<Artifact> {
    let artifact_id_raw: String = row.try_get("artifact_id")?;
    let file_target_id_raw: String = row.try_get("file_target_id")?;
    let kind_raw: String = row.try_get("kind")?;
    let status_raw: String = row.try_get("status")?;

    let artifact_id = Uuid::parse_str(&artifact_id_raw)
        .map_err(|_| DbError::InvalidUuid(artifact_id_raw.clone()))?;
    let file_target_id = Uuid::parse_str(&file_target_id_raw)
        .map_err(|_| DbError::InvalidUuid(file_target_id_raw.clone()))?;

    let kind = ArtifactKind::from_str(&kind_raw)
        .ok_or_else(|| DbError::InvalidArtifactKind(kind_raw.clone()))?;
    let status = ArtifactStatus::from_str(&status_raw)
        .ok_or_else(|| DbError::InvalidArtifactStatus(status_raw.clone()))?;

    Ok(Artifact {
        artifact_id,
        file_target_id,
        kind,
        rel_path: row.try_get("rel_path")?,
        size_bytes: row.try_get("size_bytes")?,
        checksum: row.try_get("checksum")?,
        tool: row.try_get("tool")?,
        status,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

/// Hydrates a validation record for an artifact.
#[allow(dead_code)]
pub fn build_validation(row: &SqliteRow) -> DbResult<Validation> {
    let validation_id_raw: String = row.try_get("validation_id")?;
    let artifact_id_raw: String = row.try_get("artifact_id")?;

    let validation_id = Uuid::parse_str(&validation_id_raw)
        .map_err(|_| DbError::InvalidUuid(validation_id_raw.clone()))?;
    let artifact_id = Uuid::parse_str(&artifact_id_raw)
        .map_err(|_| DbError::InvalidUuid(artifact_id_raw.clone()))?;

    let result_json: Option<String> = row.try_get("result_json")?;
    let result_json = match result_json {
        Some(raw) => Some(serde_json::from_str::<Value>(&raw)?),
        None => None,
    };

    let passed_value: i64 = row.try_get("passed")?;
    let passed = passed_value != 0;

    Ok(Validation {
        validation_id,
        artifact_id,
        validator: row.try_get("validator")?,
        passed,
        result_json,
        created_at: row.try_get("created_at")?,
    })
}

/// Hydrates a project note row.
#[allow(dead_code)]
pub fn build_note(row: &SqliteRow) -> DbResult<Note> {
    let note_id_raw: String = row.try_get("note_id")?;
    let project_id_raw: String = row.try_get("project_id")?;

    let note_id =
        Uuid::parse_str(&note_id_raw).map_err(|_| DbError::InvalidUuid(note_id_raw.clone()))?;
    let project_id = Uuid::parse_str(&project_id_raw)
        .map_err(|_| DbError::InvalidProjectId(project_id_raw.clone()))?;

    Ok(Note {
        note_id,
        project_id,
        author_user_id: row.try_get("author_user_id")?,
        body: row.try_get("body")?,
        created_at: row.try_get("created_at")?,
    })
}

/// Hydrates a background job row.
#[allow(dead_code)]
pub fn build_job(row: &SqliteRow) -> DbResult<Job> {
    let job_id_raw: String = row.try_get("job_id")?;
    let project_id_raw: String = row.try_get("project_id")?;
    let job_type_raw: String = row.try_get("job_type")?;
    let state_raw: String = row.try_get("state")?;

    let job_id =
        Uuid::parse_str(&job_id_raw).map_err(|_| DbError::InvalidUuid(job_id_raw.clone()))?;
    let project_id = Uuid::parse_str(&project_id_raw)
        .map_err(|_| DbError::InvalidProjectId(project_id_raw.clone()))?;

    let job_type = JobType::from_str(&job_type_raw)
        .ok_or_else(|| DbError::InvalidJobType(job_type_raw.clone()))?;
    let state = JobState::from_str(&state_raw)
        .ok_or_else(|| DbError::InvalidJobState(state_raw.clone()))?;

    let file_target_id = row
        .try_get::<Option<String>, _>("file_target_id")?
        .map(|value| Uuid::parse_str(&value).map_err(|_| DbError::InvalidUuid(value.clone())))
        .transpose()?;

    let artifact_id = row
        .try_get::<Option<String>, _>("artifact_id")?
        .map(|value| Uuid::parse_str(&value).map_err(|_| DbError::InvalidUuid(value.clone())))
        .transpose()?;

    Ok(Job {
        job_id,
        project_id,
        job_type,
        job_key: row.try_get("job_key")?,
        file_target_id,
        artifact_id,
        state,
        attempts: row.try_get("attempts")?,
        error: row.try_get("error")?,
        created_at: row.try_get("created_at")?,
        started_at: row.try_get("started_at")?,
        finished_at: row.try_get("finished_at")?,
    })
}

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
        hash_sha256: row
            .try_get::<Option<String>, _>("hash_sha256")?
            .and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            }),
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

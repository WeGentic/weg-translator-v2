//! Operations that interact with `file_targets` rows for the extraction pipeline.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use log::{info, warn};
use sha2::{Digest, Sha256};
use sqlx::Row;
use tokio::fs;
use tokio::io::AsyncReadExt;
use uuid::Uuid;

use crate::db::builders::{
    build_file_target, build_language_pair, build_project_file_conversion, conversion_projection,
};
use crate::db::error::{DbError, DbResult};
use crate::db::manager::DbManager;
use crate::db::types::{
    ArtifactKind, ArtifactStatus, FileTarget, FileTargetBackfillSummary, FileTargetBridgeOutcome,
    FileTargetStatus, FilesystemArtifactBackfillSummary, LanguagePair, ProjectDetails,
    ProjectFileConversionRow, ProjectFileConversionStatus,
};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Attempts to resolve the file target for the provided file and language pair.
    pub async fn find_file_target(
        &self,
        project_id: Uuid,
        project_file_id: Uuid,
        src_lang: &str,
        tgt_lang: &str,
    ) -> DbResult<Option<Uuid>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT ft.file_target_id
             FROM file_targets ft
             INNER JOIN project_language_pairs lp
               ON lp.pair_id = ft.pair_id
             WHERE ft.file_id = ?1
               AND lp.project_id = ?2
               AND lp.src_lang = ?3 COLLATE NOCASE
               AND lp.trg_lang = ?4 COLLATE NOCASE
             LIMIT 1",
        )
        .bind(&project_file_id.to_string())
        .bind(&project_id.to_string())
        .bind(src_lang)
        .bind(tgt_lang)
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let id_str: String = row.try_get("file_target_id")?;
            let file_target_id =
                Uuid::parse_str(&id_str).map_err(|_| DbError::InvalidUuid(id_str.clone()))?;
            return Ok(Some(file_target_id));
        }

        Ok(None)
    }

    /// Fetches a specific file target by identifier.
    pub async fn get_file_target_by_id(
        &self,
        file_target_id: Uuid,
    ) -> DbResult<Option<FileTarget>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_target_id = ?1
             LIMIT 1",
        )
        .bind(&file_target_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let file_target = build_file_target(&row)?;
            return Ok(Some(file_target));
        }

        Ok(None)
    }

    /// Retrieves the language pair associated with the provided identifier.
    pub async fn get_language_pair_by_id(&self, pair_id: Uuid) -> DbResult<Option<LanguagePair>> {
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

    /// Lists file targets associated with a project file.
    pub async fn list_file_targets_for_file(
        &self,
        project_file_id: Uuid,
    ) -> DbResult<Vec<FileTarget>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_id = ?1
             ORDER BY created_at ASC",
        )
        .bind(&project_file_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut targets = Vec::with_capacity(rows.len());
        for row in rows {
            targets.push(build_file_target(&row)?);
        }

        Ok(targets)
    }

    /// Inserts a new file target row and returns the hydrated representation.
    pub async fn insert_file_target(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<FileTarget> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let file_target_id = Uuid::new_v4();
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO file_targets (
                 file_target_id,
                 file_id,
                 pair_id,
                 status,
                 created_at,
                 updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             RETURNING file_target_id, file_id, pair_id, status, created_at, updated_at",
        )
        .bind(&file_target_id.to_string())
        .bind(&file_id.to_string())
        .bind(&pair_id.to_string())
        .bind(status.as_str())
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_file_target(&row)
    }

    /// Ensures a file target exists for the provided file and language pair.
    pub async fn ensure_file_target(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<FileTarget> {
        if let Some(existing) = self
            .get_file_target_by_file_and_pair(file_id, pair_id)
            .await?
        {
            return Ok(existing);
        }

        self.insert_file_target(file_id, pair_id, status).await
    }

    /// Updates a file target status while refreshing its `updated_at` timestamp.
    pub async fn update_file_target_status(
        &self,
        file_target_id: Uuid,
        status: FileTargetStatus,
    ) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let result = sqlx::query(
            "UPDATE file_targets
             SET status = ?1,
                 updated_at = ?2
             WHERE file_target_id = ?3",
        )
        .bind(status.as_str())
        .bind(&now)
        .bind(&file_target_id.to_string())
        .execute(&pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::InvalidUuid(file_target_id.to_string()));
        }

        Ok(())
    }

    /// Retrieves a file target using the composite key (file_id, pair_id).
    pub async fn get_file_target_by_file_and_pair(
        &self,
        file_id: Uuid,
        pair_id: Uuid,
    ) -> DbResult<Option<FileTarget>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT file_target_id, file_id, pair_id, status, created_at, updated_at
             FROM file_targets
             WHERE file_id = ?1
               AND pair_id = ?2
             LIMIT 1",
        )
        .bind(&file_id.to_string())
        .bind(&pair_id.to_string())
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let target = build_file_target(&row)?;
            return Ok(Some(target));
        }

        Ok(None)
    }
}

impl DbManager {
    /// Backfills legacy conversion records into the file target + artifact model.
    pub async fn backfill_file_targets_from_legacy(
        &self,
        project_filter: Option<&[Uuid]>,
    ) -> DbResult<FileTargetBackfillSummary> {
        let filter: Option<std::collections::HashSet<Uuid>> =
            project_filter.map(|ids| ids.iter().copied().collect());

        let pool = self.pool().await;
        let rows = sqlx::query("SELECT id FROM projects")
            .fetch_all(&pool)
            .await?;

        let mut project_ids = Vec::new();
        for row in rows {
            let id_raw: String = row.try_get("id")?;
            let project_id =
                Uuid::parse_str(&id_raw).map_err(|_| DbError::InvalidUuid(id_raw.clone()))?;

            if let Some(ref filter_set) = filter {
                if !filter_set.contains(&project_id) {
                    continue;
                }
            }

            project_ids.push(project_id);
        }

        let mut summary = FileTargetBackfillSummary {
            scanned_projects: project_ids.len() as u64,
            ..FileTargetBackfillSummary::default()
        };

        for project_id in project_ids {
            let outcomes = self.bridge_project_conversions(project_id).await?;
            if outcomes.is_empty() {
                continue;
            }

            info!(
                target: "db::file_targets",
                "backfill bridged {} conversion(s) for project {}",
                outcomes.len(),
                project_id
            );

            summary.bridged_conversions += outcomes.len() as u64;

            for outcome in outcomes {
                if outcome.created_language_pair {
                    summary.newly_created_language_pairs += 1;
                }
                if outcome.created_file_target {
                    summary.newly_created_file_targets += 1;
                }
                if outcome.updated_status {
                    summary.updated_statuses += 1;
                }
                if outcome.xliff_artifact_id.is_some() {
                    summary.xliff_artifacts_upserted += 1;
                }
                if outcome.jliff_artifact_id.is_some() {
                    summary.jliff_artifacts_upserted += 1;
                }
            }
        }

        Ok(summary)
    }

    /// Registers artifacts already present on disk into the artifacts table.
    pub async fn backfill_artifacts_from_disk(
        &self,
        project_filter: Option<&[Uuid]>,
    ) -> DbResult<FilesystemArtifactBackfillSummary> {
        const XLIFF_DIR_CANDIDATES: &[&str] = &["artifacts/xliff", "xliff"];
        const XJLIFF_DIR_CANDIDATES: &[&str] =
            &["artifacts/xjliff", "artifacts/jliff", "xjliff", "jliff"];

        let filter: Option<HashSet<Uuid>> = project_filter.map(|ids| ids.iter().copied().collect());

        let pool = self.pool().await;
        let rows = sqlx::query("SELECT id FROM projects")
            .fetch_all(&pool)
            .await?;

        let mut summary = FilesystemArtifactBackfillSummary::default();

        for row in rows {
            let id_raw: String = row.try_get("id")?;
            let project_id =
                Uuid::parse_str(&id_raw).map_err(|_| DbError::InvalidUuid(id_raw.clone()))?;
            if let Some(ref filter_set) = filter {
                if !filter_set.contains(&project_id) {
                    continue;
                }
            }

            summary.projects_scanned += 1;

            let details = match self.list_project_details(project_id).await {
                Ok(details) => details,
                Err(error) => {
                    warn!(
                        target: "db::file_targets",
                        "skipping project {} during artifact registration: {}",
                        project_id, error
                    );
                    continue;
                }
            };

            let root_path = PathBuf::from(&details.root_path);
            if !root_path.is_dir() {
                warn!(
                    target: "db::file_targets",
                    "project {} root '{}' missing on disk; skipping artifact discovery",
                    project_id, details.root_path
                );
                continue;
            }

            let mut pair_map: HashMap<String, Vec<LanguagePair>> = self
                .list_language_pairs_for_project(project_id)
                .await?
                .into_iter()
                .fold(HashMap::new(), |mut acc, pair| {
                    let key = artifact_language_dir_key(&pair.src_lang, &pair.trg_lang);
                    acc.entry(key).or_default().push(pair);
                    acc
                });

            let conversion_lookup = build_conversion_lookup(&details);

            for rel in XLIFF_DIR_CANDIDATES {
                let candidate = root_path.join(rel);
                if !candidate.is_dir() {
                    continue;
                }
                self.ingest_artifact_directory(
                    project_id,
                    &root_path,
                    &candidate,
                    ArtifactKind::Xliff,
                    &mut pair_map,
                    &conversion_lookup,
                    &mut summary,
                )
                .await?;
            }

            for rel in XJLIFF_DIR_CANDIDATES {
                let candidate = root_path.join(rel);
                if !candidate.is_dir() {
                    continue;
                }
                self.ingest_artifact_directory(
                    project_id,
                    &root_path,
                    &candidate,
                    ArtifactKind::Jliff,
                    &mut pair_map,
                    &conversion_lookup,
                    &mut summary,
                )
                .await?;
            }
        }

        Ok(summary)
    }

    async fn ingest_artifact_directory(
        &self,
        project_id: Uuid,
        root_path: &Path,
        dir_path: &Path,
        kind: ArtifactKind,
        pair_map: &mut HashMap<String, Vec<LanguagePair>>,
        conversion_lookup: &HashMap<Uuid, Vec<ProjectFileConversionRow>>,
        summary: &mut FilesystemArtifactBackfillSummary,
    ) -> DbResult<()> {
        let mut dir_iter = fs::read_dir(dir_path).await?;
        while let Some(entry) = dir_iter.next_entry().await? {
            let file_type = entry.file_type().await?;
            if !file_type.is_dir() {
                continue;
            }

            let lang_dir_name = match entry.file_name().into_string() {
                Ok(value) => value,
                Err(_) => {
                    summary.skipped_unknown_language += 1;
                    continue;
                }
            };
            let lang_key = lang_dir_name.clone();

            let mut file_iter = fs::read_dir(entry.path()).await?;
            while let Some(file_entry) = file_iter.next_entry().await? {
                let file_type = file_entry.file_type().await?;
                if !file_type.is_file() {
                    continue;
                }

                let file_name = match file_entry.file_name().into_string() {
                    Ok(value) => value,
                    Err(_) => {
                        summary.skipped_invalid_name += 1;
                        continue;
                    }
                };

                if kind == ArtifactKind::Jliff
                    && file_name.to_ascii_lowercase().ends_with(".tags.json")
                {
                    continue;
                }

                let file_id = match parse_artifact_file_uuid(&file_name, kind) {
                    Some(value) => value,
                    None => {
                        summary.skipped_invalid_name += 1;
                        continue;
                    }
                };

                let pair = match self
                    .resolve_language_pair_for_artifact(
                        project_id,
                        &lang_key,
                        file_id,
                        pair_map,
                        conversion_lookup.get(&file_id).map(|rows| rows.as_slice()),
                    )
                    .await?
                {
                    Some(pair) => pair,
                    None => {
                        summary.skipped_unknown_language += 1;
                        continue;
                    }
                };

                let mut file_target = match self
                    .get_file_target_by_file_and_pair(file_id, pair.pair_id)
                    .await?
                {
                    Some(target) => target,
                    None => {
                        self.insert_file_target(file_id, pair.pair_id, FileTargetStatus::Extracted)
                            .await?
                    }
                };

                if file_target.status != FileTargetStatus::Extracted {
                    self.update_file_target_status(
                        file_target.file_target_id,
                        FileTargetStatus::Extracted,
                    )
                    .await?;
                    file_target = self
                        .get_file_target_by_id(file_target.file_target_id)
                        .await?
                        .ok_or_else(|| {
                            DbError::InvalidUuid(file_target.file_target_id.to_string())
                        })?;
                }

                let abs_path = file_entry.path();
                let rel_path = match abs_path.strip_prefix(root_path) {
                    Ok(rel) => rel.to_string_lossy().to_string(),
                    Err(_) => {
                        summary.skipped_invalid_name += 1;
                        continue;
                    }
                };

                let (byte_len, checksum) = match compute_file_checksum(&abs_path).await {
                    Ok(value) => value,
                    Err(error) => {
                        warn!(
                            target: "db::file_targets",
                            "failed to hash artifact {:?}: {}",
                            abs_path, error
                        );
                        summary.checksum_failures += 1;
                        continue;
                    }
                };
                let size_bytes = match i64::try_from(byte_len) {
                    Ok(value) => Some(value),
                    Err(_) => {
                        warn!(
                            target: "db::file_targets",
                            "artifact {:?} exceeds i64 range; persisting without size metadata",
                            abs_path
                        );
                        None
                    }
                };

                let existing = self
                    .find_artifact_by_kind(file_target.file_target_id, kind)
                    .await?;
                if let Some(record) = existing {
                    let matches = record.rel_path == rel_path
                        && record.checksum.as_deref() == Some(&checksum)
                        && record.size_bytes == size_bytes
                        && record.status == ArtifactStatus::Generated
                        && record.tool.as_deref() == Some(LEGACY_TOOL);
                    if matches {
                        summary.already_indexed += 1;
                        continue;
                    }
                }

                self.upsert_artifact(
                    file_target.file_target_id,
                    kind,
                    &rel_path,
                    size_bytes,
                    Some(&checksum),
                    Some(LEGACY_TOOL),
                    ArtifactStatus::Generated,
                )
                .await?;

                if matches!(kind, ArtifactKind::Xliff) {
                    summary.xliff_registered += 1;
                } else if matches!(kind, ArtifactKind::Jliff) {
                    summary.jliff_registered += 1;
                }
            }
        }

        Ok(())
    }

    async fn resolve_language_pair_for_artifact(
        &self,
        project_id: Uuid,
        lang_key: &str,
        file_id: Uuid,
        pair_map: &mut HashMap<String, Vec<LanguagePair>>,
        conversions: Option<&[ProjectFileConversionRow]>,
    ) -> DbResult<Option<LanguagePair>> {
        if let Some(entries) = pair_map.get(lang_key) {
            if entries.len() == 1 {
                return Ok(entries.first().cloned());
            }
        }

        if let Some(conversions) = conversions {
            for conversion in conversions {
                if artifact_language_dir_key(&conversion.src_lang, &conversion.tgt_lang) == lang_key
                {
                    if let Some(entries) = pair_map.get(lang_key) {
                        if let Some(pair) = entries.iter().find(|pair| {
                            pair.src_lang.eq_ignore_ascii_case(&conversion.src_lang)
                                && pair.trg_lang.eq_ignore_ascii_case(&conversion.tgt_lang)
                        }) {
                            return Ok(Some(pair.clone()));
                        }
                    }

                    let pair = self
                        .ensure_language_pair(
                            project_id,
                            &conversion.src_lang,
                            &conversion.tgt_lang,
                        )
                        .await?;
                    pair_map
                        .entry(lang_key.to_string())
                        .or_default()
                        .push(pair.clone());
                    return Ok(Some(pair));
                }
            }
        }

        if let Some(entries) = pair_map.get(lang_key) {
            if let Some(pair) = entries.first() {
                return Ok(Some(pair.clone()));
            }
        }

        warn!(
            target: "db::file_targets",
            "unable to resolve language pair for project file {} in directory '{}'",
            file_id, lang_key
        );
        Ok(None)
    }

    /// Bridges a legacy conversion row into the file target + artifact model.
    pub async fn bridge_file_target_from_conversion(
        &self,
        project_id: Uuid,
        conversion: &ProjectFileConversionRow,
    ) -> DbResult<FileTargetBridgeOutcome> {
        let desired_status = derive_status_from_conversion(conversion);

        let existing_pair = self
            .find_language_pair(project_id, &conversion.src_lang, &conversion.tgt_lang)
            .await?;
        let (language_pair, created_language_pair) = match existing_pair {
            Some(pair) => (pair, false),
            None => (
                self.insert_language_pair(project_id, &conversion.src_lang, &conversion.tgt_lang)
                    .await?,
                true,
            ),
        };

        let existing_target = self
            .get_file_target_by_file_and_pair(conversion.project_file_id, language_pair.pair_id)
            .await?;

        let mut created_file_target = false;
        let mut file_target = match existing_target {
            Some(target) => target,
            None => {
                created_file_target = true;
                self.insert_file_target(
                    conversion.project_file_id,
                    language_pair.pair_id,
                    desired_status,
                )
                .await?
            }
        };

        let mut updated_status = false;
        if should_update_status(file_target.status, desired_status) {
            self.update_file_target_status(file_target.file_target_id, desired_status)
                .await?;
            file_target = self
                .get_file_target_by_id(file_target.file_target_id)
                .await?
                .ok_or_else(|| DbError::InvalidUuid(file_target.file_target_id.to_string()))?;
            updated_status = true;
        }

        let mut xliff_artifact_id = None;
        if let Some(xliff_rel) = conversion.xliff_rel_path.as_deref() {
            let artifact = self
                .upsert_artifact(
                    file_target.file_target_id,
                    ArtifactKind::Xliff,
                    xliff_rel,
                    None,
                    None,
                    Some("OpenXLIFF"),
                    ArtifactStatus::Generated,
                )
                .await?;
            xliff_artifact_id = Some(artifact.artifact_id);
        }

        let mut jliff_artifact_id = None;
        if let Some(jliff_rel) = conversion.jliff_rel_path.as_deref() {
            let artifact = self
                .upsert_artifact(
                    file_target.file_target_id,
                    ArtifactKind::Jliff,
                    jliff_rel,
                    None,
                    None,
                    Some("OpenXLIFF"),
                    ArtifactStatus::Generated,
                )
                .await?;
            jliff_artifact_id = Some(artifact.artifact_id);
        }

        Ok(FileTargetBridgeOutcome {
            language_pair,
            file_target,
            created_language_pair,
            created_file_target,
            updated_status,
            xliff_artifact_id,
            jliff_artifact_id,
        })
    }

    /// Bridges all conversions associated with a project.
    pub async fn bridge_project_conversions(
        &self,
        project_id: Uuid,
    ) -> DbResult<Vec<FileTargetBridgeOutcome>> {
        let pool = self.pool().await;
        let columns = conversion_projection();
        let prefixed_columns = columns
            .split(',')
            .map(|column| format!("c.{}", column.trim()))
            .collect::<Vec<_>>()
            .join(", ");
        let statement = format!(
            "SELECT {columns}
             FROM project_file_conversions c
             INNER JOIN project_files pf ON pf.id = c.project_file_id
             WHERE pf.project_id = ?1",
            columns = prefixed_columns,
        );

        let rows = sqlx::query(&statement)
            .bind(&project_id.to_string())
            .fetch_all(&pool)
            .await?;

        let mut outcomes = Vec::with_capacity(rows.len());
        for row in rows {
            let conversion = build_project_file_conversion(&row)?;
            let outcome = self
                .bridge_file_target_from_conversion(project_id, &conversion)
                .await?;
            outcomes.push(outcome);
        }

        Ok(outcomes)
    }
}

fn derive_status_from_conversion(conversion: &ProjectFileConversionRow) -> FileTargetStatus {
    match conversion.status {
        ProjectFileConversionStatus::Completed => {
            if conversion.xliff_rel_path.is_some() {
                FileTargetStatus::Extracted
            } else {
                FileTargetStatus::Pending
            }
        }
        ProjectFileConversionStatus::Failed => FileTargetStatus::Failed,
        _ => FileTargetStatus::Pending,
    }
}

fn should_update_status(current: FileTargetStatus, desired: FileTargetStatus) -> bool {
    match (current, desired) {
        (FileTargetStatus::Pending, FileTargetStatus::Extracted) => true,
        (FileTargetStatus::Pending, FileTargetStatus::Failed) => true,
        (FileTargetStatus::Extracted, FileTargetStatus::Failed) => true,
        (FileTargetStatus::Failed, FileTargetStatus::Extracted) => true,
        _ => false,
    }
}

const LEGACY_TOOL: &str = "LegacyImport";

fn build_conversion_lookup(
    details: &ProjectDetails,
) -> HashMap<Uuid, Vec<ProjectFileConversionRow>> {
    let mut map = HashMap::new();
    for file in &details.files {
        map.insert(file.file.id, file.conversions.clone());
    }
    map
}

fn artifact_language_dir_key(src_lang: &str, tgt_lang: &str) -> String {
    format!(
        "{}__{}",
        sanitize_segment(src_lang),
        sanitize_segment(tgt_lang)
    )
}

fn sanitize_segment(value: &str) -> String {
    let mut sanitized = String::new();
    let mut last_was_dash = false;

    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            sanitized.push(ch);
            last_was_dash = false;
        } else if ch == '-' {
            if !last_was_dash {
                sanitized.push('-');
                last_was_dash = true;
            }
        } else if !last_was_dash {
            sanitized.push('-');
            last_was_dash = true;
        }
    }

    let trimmed = sanitized.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "unknown".into()
    } else {
        trimmed
    }
}

fn parse_artifact_file_uuid(name: &str, kind: ArtifactKind) -> Option<Uuid> {
    match kind {
        ArtifactKind::Xliff => {
            let lower = name.to_ascii_lowercase();
            if lower.ends_with(".xlf") {
                let prefix_len = name.len().saturating_sub(4);
                let prefix = &name[..prefix_len];
                Uuid::parse_str(prefix).ok()
            } else if lower.ends_with(".xliff") {
                let prefix_len = name.len().saturating_sub(6);
                let prefix = &name[..prefix_len];
                Uuid::parse_str(prefix).ok()
            } else {
                None
            }
        }
        ArtifactKind::Jliff => {
            let lower = name.to_ascii_lowercase();
            if lower.ends_with(".jliff.json") {
                let prefix_len = name.len().saturating_sub(".jliff.json".len());
                let prefix = &name[..prefix_len];
                Uuid::parse_str(prefix).ok()
            } else {
                None
            }
        }
        _ => None,
    }
}

async fn compute_file_checksum(path: &Path) -> Result<(u64, String), std::io::Error> {
    let mut file = fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut total: u64 = 0;
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }
        total += bytes_read as u64;
        hasher.update(&buffer[..bytes_read]);
    }

    Ok((total, format!("{:x}", hasher.finalize())))
}

//! Project operations aligned with the new schema.

use std::collections::HashSet;

use sqlx::{QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::db::types::{
    FileInfoRecord, FileLanguagePairInput, FileLanguagePairRecord, NewFileInfoArgs, NewProjectArgs,
    NewProjectFileArgs, ProjectBundle, ProjectConversionStats, ProjectFileBundle,
    ProjectFileRecord, ProjectFileTotals, ProjectJobStats, ProjectLanguagePairInput,
    ProjectLanguagePairRecord, ProjectListRecord, ProjectProgressStats, ProjectRecord,
    ProjectStatistics, ProjectSubjectInput, ProjectSubjectRecord, ProjectWarningStats,
    UpdateProjectArgs,
};

/// Creates a project with associated subjects and language pairs.
pub async fn create_project(pool: &SqlitePool, args: NewProjectArgs) -> DbResult<ProjectBundle> {
    if args.language_pairs.is_empty() {
        return Err(DbError::ConstraintViolation(
            "project requires at least one language pair",
        ));
    }

    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO projects (
            project_uuid,
            project_name,
            project_status,
            user_uuid,
            client_uuid,
            type,
            notes
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
    )
    .bind(args.project_uuid)
    .bind(&args.project_name)
    .bind(&args.project_status)
    .bind(args.user_uuid)
    .bind(args.client_uuid)
    .bind(&args.r#type)
    .bind(&args.notes)
    .execute(&mut *tx)
    .await?;

    insert_subjects(&mut tx, args.project_uuid, &args.subjects).await?;
    insert_project_language_pairs(&mut tx, args.project_uuid, &args.language_pairs).await?;

    let bundle = fetch_project_bundle(&mut tx, args.project_uuid).await?;
    tx.commit().await?;

    bundle.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Updates project core attributes and optionally replaces subjects/lang pairs.
pub async fn update_project(
    pool: &SqlitePool,
    args: UpdateProjectArgs,
) -> DbResult<Option<ProjectBundle>> {
    let mut tx = pool.begin().await?;

    if args.project_name.is_some()
        || args.project_status.is_some()
        || args.user_uuid.is_some()
        || args.client_uuid.is_some()
        || args.r#type.is_some()
        || args.notes.is_some()
    {
        let mut builder = QueryBuilder::<Sqlite>::new("UPDATE projects SET ");
        let mut first = true;

        if let Some(name) = args.project_name.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("project_name = ");
            builder.push_bind(name);
            first = false;
        }

        if let Some(status) = args.project_status.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("project_status = ");
            builder.push_bind(status);
            first = false;
        }

        if let Some(user_uuid) = args.user_uuid.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("user_uuid = ");
            builder.push_bind(user_uuid);
            first = false;
        }

        if let Some(client_uuid) = args.client_uuid.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("client_uuid = ");
            builder.push_bind(client_uuid.clone());
            first = false;
        }

        if let Some(project_type) = args.r#type.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("type = ");
            builder.push_bind(project_type);
            first = false;
        }

        if let Some(notes) = args.notes.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("notes = ");
            builder.push_bind(notes.clone());
        }

        builder.push(" WHERE project_uuid = ");
        builder.push_bind(args.project_uuid);
        builder.build().execute(&mut *tx).await?;
    }

    if let Some(subjects) = args.subjects.as_ref() {
        replace_subjects(&mut tx, args.project_uuid, subjects).await?;
    }

    if let Some(language_pairs) = args.language_pairs.as_ref() {
        if language_pairs.is_empty() {
            return Err(DbError::ConstraintViolation(
                "project requires at least one language pair",
            ));
        }
        replace_project_language_pairs(&mut tx, args.project_uuid, language_pairs).await?;
    }

    let bundle = fetch_project_bundle(&mut tx, args.project_uuid).await?;
    tx.commit().await?;

    Ok(bundle)
}

/// Deletes a project and cascaded rows.
pub async fn delete_project(pool: &SqlitePool, project_uuid: Uuid) -> DbResult<()> {
    sqlx::query("DELETE FROM projects WHERE project_uuid = ?1")
        .bind(project_uuid)
        .execute(pool)
        .await?;
    Ok(())
}

/// Retrieves a bundled project view.
pub async fn get_project(pool: &SqlitePool, project_uuid: Uuid) -> DbResult<Option<ProjectBundle>> {
    let mut tx = pool.begin().await?;
    let bundle = fetch_project_bundle(&mut tx, project_uuid).await?;
    tx.commit().await?;
    Ok(bundle)
}

/// Computes aggregate statistics for a project.
pub async fn get_project_statistics(
    pool: &SqlitePool,
    project_uuid: Uuid,
) -> DbResult<Option<ProjectStatistics>> {
    let mut tx = pool.begin().await?;
    let bundle = fetch_project_bundle(&mut tx, project_uuid).await?;
    tx.commit().await?;
    Ok(match bundle {
        Some(bundle) => Some(compute_project_statistics(&bundle)),
        None => None,
    })
}

/// Lists project records without eager loading relations while including derived aggregates.
pub async fn list_projects(pool: &SqlitePool) -> DbResult<Vec<ProjectListRecord>> {
    let rows: Vec<ProjectListRecord> = sqlx::query_as(
        r#"
        SELECT
            p.project_uuid,
            p.project_name,
            p.creation_date,
            p.update_date,
            p.project_status,
            p.user_uuid,
            p.client_uuid,
            c.name AS client_name,
            p.type,
            p.notes,
            COALESCE(
                (
                    SELECT json_group_array(subject)
                    FROM project_subjects ps
                    WHERE ps.project_uuid = p.project_uuid
                ),
                json('[]')
            ) AS subjects,
            (
                SELECT COUNT(*)
                FROM project_files pf
                WHERE pf.project_uuid = p.project_uuid
            ) AS file_count
        FROM projects p
        LEFT JOIN clients c ON c.client_uuid = p.client_uuid
        ORDER BY p.creation_date DESC, p.project_name COLLATE NOCASE ASC
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Associates a file with a project (helper for project pipelines).
pub async fn attach_project_file(
    pool: &SqlitePool,
    file_info: NewFileInfoArgs,
    link: NewProjectFileArgs,
) -> DbResult<ProjectFileBundle> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO file_info (file_uuid, ext, type, size_bytes, segment_count, token_count, notes)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(file_uuid) DO UPDATE SET
            ext = excluded.ext,
            type = excluded.type,
            size_bytes = excluded.size_bytes,
            segment_count = excluded.segment_count,
            token_count = excluded.token_count,
            notes = excluded.notes
        "#,
    )
    .bind(file_info.file_uuid)
    .bind(&file_info.ext)
    .bind(&file_info.r#type)
    .bind(file_info.size_bytes)
    .bind(file_info.segment_count)
    .bind(file_info.token_count)
    .bind(&file_info.notes)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO project_files (project_uuid, file_uuid, filename, stored_at, type)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(project_uuid, file_uuid) DO UPDATE SET
            filename = excluded.filename,
            stored_at = excluded.stored_at,
            type = excluded.type
        "#,
    )
    .bind(link.project_uuid)
    .bind(link.file_uuid)
    .bind(&link.filename)
    .bind(&link.stored_at)
    .bind(&link.r#type)
    .execute(&mut *tx)
    .await?;

    replace_file_language_pairs(
        &mut tx,
        link.project_uuid,
        link.file_uuid,
        &link.language_pairs,
    )
    .await?;

    let bundle = fetch_file_bundle(&mut tx, link.project_uuid, link.file_uuid).await?;
    tx.commit().await?;

    bundle.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Removes a project file and metadata.
pub async fn detach_project_file(
    pool: &SqlitePool,
    project_uuid: Uuid,
    file_uuid: Uuid,
) -> DbResult<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM artifacts WHERE project_uuid = ?1 AND file_uuid = ?2")
        .bind(project_uuid)
        .bind(file_uuid)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM project_files WHERE project_uuid = ?1 AND file_uuid = ?2")
        .bind(project_uuid)
        .bind(file_uuid)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM file_info WHERE file_uuid = ?1")
        .bind(file_uuid)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

/// Updates the semantic role/type for an attached project file.
pub async fn update_project_file_role(
    pool: &SqlitePool,
    project_uuid: Uuid,
    file_uuid: Uuid,
    next_role: &str,
) -> DbResult<ProjectFileBundle> {
    const VALID_ROLES: &[&str] = &["processable", "reference", "instructions", "image"];

    let normalized = next_role.trim().to_lowercase();
    if !VALID_ROLES.contains(&normalized.as_str()) {
        return Err(DbError::ConstraintViolation("invalid project file role"));
    }

    let mut tx = pool.begin().await?;
    let Some(_existing) = fetch_file_bundle(&mut tx, project_uuid, file_uuid).await? else {
        return Err(sqlx::Error::RowNotFound.into());
    };

    sqlx::query("UPDATE project_files SET type = ?1 WHERE project_uuid = ?2 AND file_uuid = ?3")
        .bind(&normalized)
        .bind(project_uuid)
        .bind(file_uuid)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE file_info SET type = ?1 WHERE file_uuid = ?2")
        .bind(&normalized)
        .bind(file_uuid)
        .execute(&mut *tx)
        .await?;

    if normalized == "processable" {
        let project_pairs = sqlx::query_as::<_, ProjectLanguagePairRecord>(
            "SELECT * FROM project_language_pairs WHERE project_uuid = ?1 ORDER BY source_lang, target_lang",
        )
        .bind(project_uuid)
        .fetch_all(tx.as_mut())
        .await?;

        if project_pairs.is_empty() {
            return Err(DbError::ConstraintViolation(
                "processable files require project language pairs",
            ));
        }

        let inputs: Vec<FileLanguagePairInput> = project_pairs
            .into_iter()
            .map(|pair| FileLanguagePairInput {
                source_lang: pair.source_lang,
                target_lang: pair.target_lang,
            })
            .collect();

        replace_file_language_pairs(&mut tx, project_uuid, file_uuid, &inputs).await?;
    } else {
        sqlx::query("DELETE FROM file_language_pairs WHERE project_uuid = ?1 AND file_uuid = ?2")
            .bind(project_uuid)
            .bind(file_uuid)
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM artifacts WHERE project_uuid = ?1 AND file_uuid = ?2")
            .bind(project_uuid)
            .bind(file_uuid)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("UPDATE projects SET update_date = update_date WHERE project_uuid = ?1")
        .bind(project_uuid)
        .execute(&mut *tx)
        .await?;

    let updated = fetch_file_bundle(&mut tx, project_uuid, file_uuid).await?;
    tx.commit().await?;

    updated.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

async fn insert_subjects(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    subjects: &[ProjectSubjectInput],
) -> DbResult<()> {
    for subject in subjects {
        sqlx::query(
            "INSERT INTO project_subjects (project_uuid, subject)
             VALUES (?1, ?2)",
        )
        .bind(project_uuid)
        .bind(&subject.subject)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn replace_subjects(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    subjects: &[ProjectSubjectInput],
) -> DbResult<()> {
    sqlx::query("DELETE FROM project_subjects WHERE project_uuid = ?1")
        .bind(project_uuid)
        .execute(&mut **tx)
        .await?;
    insert_subjects(tx, project_uuid, subjects).await
}

async fn insert_project_language_pairs(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    pairs: &[ProjectLanguagePairInput],
) -> DbResult<()> {
    for pair in pairs {
        sqlx::query(
            "INSERT INTO project_language_pairs (project_uuid, source_lang, target_lang)
             VALUES (?1, ?2, ?3)",
        )
        .bind(project_uuid)
        .bind(&pair.source_lang)
        .bind(&pair.target_lang)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn replace_project_language_pairs(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    pairs: &[ProjectLanguagePairInput],
) -> DbResult<()> {
    sqlx::query("DELETE FROM project_language_pairs WHERE project_uuid = ?1")
        .bind(project_uuid)
        .execute(&mut **tx)
        .await?;
    insert_project_language_pairs(tx, project_uuid, pairs).await
}

async fn replace_file_language_pairs(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    file_uuid: Uuid,
    pairs: &[FileLanguagePairInput],
) -> DbResult<()> {
    sqlx::query("DELETE FROM file_language_pairs WHERE project_uuid = ?1 AND file_uuid = ?2")
        .bind(project_uuid)
        .bind(file_uuid)
        .execute(&mut **tx)
        .await?;

    for pair in pairs {
        sqlx::query(
            "INSERT INTO file_language_pairs (project_uuid, file_uuid, source_lang, target_lang)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(project_uuid)
        .bind(file_uuid)
        .bind(&pair.source_lang)
        .bind(&pair.target_lang)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn fetch_project_bundle(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
) -> DbResult<Option<ProjectBundle>> {
    let project = sqlx::query_as::<_, ProjectRecord>(
        "SELECT * FROM projects WHERE project_uuid = ?1 LIMIT 1",
    )
    .bind(project_uuid)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(project) = project else {
        return Ok(None);
    };

    let subjects = sqlx::query_as::<_, ProjectSubjectRecord>(
        "SELECT * FROM project_subjects WHERE project_uuid = ?1 ORDER BY subject ASC",
    )
    .bind(project_uuid)
    .fetch_all(&mut **tx)
    .await?;

    let language_pairs = sqlx::query_as::<_, ProjectLanguagePairRecord>(
        "SELECT * FROM project_language_pairs WHERE project_uuid = ?1 ORDER BY source_lang, target_lang",
    )
    .bind(project_uuid)
    .fetch_all(&mut **tx)
    .await?;

    let file_links = sqlx::query_as::<_, ProjectFileRecord>(
        "SELECT * FROM project_files WHERE project_uuid = ?1 ORDER BY filename COLLATE NOCASE ASC",
    )
    .bind(project_uuid)
    .fetch_all(&mut **tx)
    .await?;

    let mut files = Vec::with_capacity(file_links.len());
    for link in file_links {
        if let Some(bundle) = fetch_file_bundle(tx, link.project_uuid, link.file_uuid).await? {
            files.push(bundle);
        }
    }

    let jobs = sqlx::query_as::<_, crate::db::types::JobRecord>(
        "SELECT * FROM jobs WHERE project_uuid = ?1",
    )
    .bind(project_uuid)
    .fetch_all(&mut **tx)
    .await?;

    Ok(Some(ProjectBundle {
        project,
        subjects,
        language_pairs,
        files,
        jobs,
    }))
}

async fn fetch_file_bundle(
    tx: &mut Transaction<'_, Sqlite>,
    project_uuid: Uuid,
    file_uuid: Uuid,
) -> DbResult<Option<ProjectFileBundle>> {
    let link = sqlx::query_as::<_, ProjectFileRecord>(
        "SELECT * FROM project_files WHERE project_uuid = ?1 AND file_uuid = ?2 LIMIT 1",
    )
    .bind(project_uuid)
    .bind(file_uuid)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(link) = link else {
        return Ok(None);
    };

    let info =
        sqlx::query_as::<_, FileInfoRecord>("SELECT * FROM file_info WHERE file_uuid = ?1 LIMIT 1")
            .bind(file_uuid)
            .fetch_one(&mut **tx)
            .await?;

    let language_pairs = sqlx::query_as::<_, FileLanguagePairRecord>(
        "SELECT * FROM file_language_pairs WHERE project_uuid = ?1 AND file_uuid = ?2 ORDER BY source_lang, target_lang",
    )
    .bind(project_uuid)
    .bind(file_uuid)
    .fetch_all(&mut **tx)
    .await?;

    let artifacts = sqlx::query_as::<_, crate::db::types::ArtifactRecord>(
        "SELECT * FROM artifacts WHERE project_uuid = ?1 AND file_uuid = ?2",
    )
    .bind(project_uuid)
    .bind(file_uuid)
    .fetch_all(&mut **tx)
    .await?;

    Ok(Some(ProjectFileBundle {
        link,
        info,
        language_pairs,
        artifacts,
    }))
}

fn compute_project_statistics(bundle: &ProjectBundle) -> ProjectStatistics {
    let mut totals = ProjectFileTotals {
        total: 0,
        processable: 0,
        reference: 0,
        instructions: 0,
        image: 0,
        other: 0,
    };

    let mut conversions = ProjectConversionStats {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        running: 0,
        other: 0,
        segments: 0,
        tokens: 0,
    };

    let mut jobs = ProjectJobStats {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        running: 0,
        other: 0,
    };

    let mut warnings = ProjectWarningStats {
        total: 0,
        failed_artifacts: 0,
        failed_jobs: 0,
    };

    let mut files_ready: HashSet<Uuid> = HashSet::new();
    let mut files_with_errors: HashSet<Uuid> = HashSet::new();

    for file in &bundle.files {
        totals.total += 1;
        let role = file.link.r#type.to_lowercase();
        match role.as_str() {
            "processable" | "source" | "xliff" | "translation" => totals.processable += 1,
            "reference" => totals.reference += 1,
            "instructions" | "instruction" => totals.instructions += 1,
            "image" => totals.image += 1,
            _ => totals.other += 1,
        }

        for artifact in &file.artifacts {
            conversions.total += 1;
            let status = artifact.status.to_lowercase();
            match status.as_str() {
                "completed" => {
                    conversions.completed += 1;
                    files_ready.insert(file.link.file_uuid);
                }
                "failed" => {
                    conversions.failed += 1;
                    files_with_errors.insert(file.link.file_uuid);
                    warnings.failed_artifacts += 1;
                }
                "pending" => conversions.pending += 1,
                "running" => conversions.running += 1,
                _ => conversions.other += 1,
            }

            if let Some(segments) = artifact.segment_count {
                if segments > 0 {
                    conversions.segments += segments;
                }
            }
            if let Some(tokens) = artifact.token_count {
                if tokens > 0 {
                    conversions.tokens += tokens;
                }
            }
        }
    }

    for job in &bundle.jobs {
        jobs.total += 1;
        let status = job.job_status.to_lowercase();
        match status.as_str() {
            "completed" => jobs.completed += 1,
            "failed" => {
                jobs.failed += 1;
                warnings.failed_jobs += 1;
            }
            "pending" => jobs.pending += 1,
            "running" => jobs.running += 1,
            _ => jobs.other += 1,
        }
    }

    warnings.total = warnings.failed_artifacts + warnings.failed_jobs;

    let processable_files = totals.processable;
    let files_ready_count = files_ready.len() as i64;
    let files_with_errors_count = files_with_errors.len() as i64;
    let percent_complete = if processable_files > 0 {
        ((files_ready_count as f32 / processable_files as f32) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    ProjectStatistics {
        totals,
        conversions,
        jobs,
        progress: ProjectProgressStats {
            processable_files,
            files_ready: files_ready_count,
            files_with_errors: files_with_errors_count,
            percent_complete,
        },
        warnings,
        last_activity: if bundle.project.update_date.is_empty() {
            None
        } else {
            Some(bundle.project.update_date.clone())
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::error::DbError;
    use crate::db::schema::initialise_schema;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(":memory:")
            .await
            .expect("expected in-memory database");
        initialise_schema(&pool)
            .await
            .expect("expected schema bootstrap to succeed");
        pool
    }

    async fn seed_user(pool: &SqlitePool, user_uuid: Uuid) {
        sqlx::query(
            "INSERT INTO users (user_uuid, username, email, phone, address)
             VALUES (?1, ?2, ?3, NULL, NULL)",
        )
        .bind(user_uuid)
        .bind("demo-user")
        .bind("demo@example.com")
        .execute(pool)
        .await
        .expect("expected user insert");
    }

    #[tokio::test]
    async fn create_project_rolls_back_on_duplicate_language_pair() {
        let pool = test_pool().await;
        let user_uuid = Uuid::new_v4();
        seed_user(&pool, user_uuid).await;

        let project_uuid = Uuid::new_v4();
        let pair = ProjectLanguagePairInput {
            source_lang: "en".into(),
            target_lang: "fr".into(),
        };

        let args = NewProjectArgs {
            project_uuid,
            project_name: "Demo project".into(),
            project_status: "draft".into(),
            user_uuid,
            client_uuid: None,
            r#type: "standard".into(),
            notes: None,
            subjects: vec![],
            language_pairs: vec![pair.clone(), pair],
        };

        let result = create_project(&pool, args).await;
        match result {
            Err(DbError::Sqlx(sqlx::Error::Database(_))) => {}
            other => panic!("expected database error, got {other:?}"),
        }

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects WHERE project_uuid = ?1")
            .bind(project_uuid)
            .fetch_one(&pool)
            .await
            .expect("expected query to succeed");
        assert_eq!(count.0, 0, "project insert should have rolled back");

        let lp_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM project_language_pairs WHERE project_uuid = ?1")
                .bind(project_uuid)
                .fetch_one(&pool)
                .await
                .expect("expected language pair count query");
        assert_eq!(
            lp_count.0, 0,
            "language pair inserts should roll back with project"
        );
    }

    #[tokio::test]
    async fn attach_project_file_rolls_back_on_invalid_language_pair() {
        let pool = test_pool().await;
        let user_uuid = Uuid::new_v4();
        seed_user(&pool, user_uuid).await;

        let project_uuid = Uuid::new_v4();
        create_project(
            &pool,
            NewProjectArgs {
                project_uuid,
                project_name: "Project with file".into(),
                project_status: "draft".into(),
                user_uuid,
                client_uuid: None,
                r#type: "standard".into(),
                notes: None,
                subjects: vec![],
                language_pairs: vec![ProjectLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "fr".into(),
                }],
            },
        )
        .await
        .expect("expected project creation to succeed");

        let file_uuid = Uuid::new_v4();
        let result = attach_project_file(
            &pool,
            NewFileInfoArgs {
                file_uuid,
                ext: "xliff".into(),
                r#type: "source".into(),
                size_bytes: Some(1024),
                segment_count: Some(10),
                token_count: Some(512),
                notes: None,
            },
            NewProjectFileArgs {
                project_uuid,
                file_uuid,
                filename: "demo.xliff".into(),
                stored_at: "2024-01-01T00:00:00Z".into(),
                r#type: "source".into(),
                language_pairs: vec![FileLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "de".into(),
                }],
            },
        )
        .await;

        match result {
            Err(DbError::Sqlx(sqlx::Error::Database(db_error))) => {
                assert!(
                    db_error
                        .message()
                        .contains("file language pair must match existing project language pair"),
                    "unexpected database error message: {}",
                    db_error.message()
                );
            }
            other => panic!("expected trigger violation, got {other:?}"),
        }

        let project_file_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM project_files WHERE file_uuid = ?1")
                .bind(file_uuid)
                .fetch_one(&pool)
                .await
                .expect("expected project_files count query");
        assert_eq!(
            project_file_count.0, 0,
            "project file insert should roll back"
        );

        let file_info_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM file_info WHERE file_uuid = ?1")
                .bind(file_uuid)
                .fetch_one(&pool)
                .await
                .expect("expected file_info count query");
        assert_eq!(file_info_count.0, 0, "file info insert should roll back");
    }

    #[tokio::test]
    async fn update_project_rolls_back_on_duplicate_subjects() {
        let pool = test_pool().await;
        let user_uuid = Uuid::new_v4();
        seed_user(&pool, user_uuid).await;

        let project_uuid = Uuid::new_v4();
        create_project(
            &pool,
            NewProjectArgs {
                project_uuid,
                project_name: "Subject project".into(),
                project_status: "draft".into(),
                user_uuid,
                client_uuid: None,
                r#type: "standard".into(),
                notes: None,
                subjects: vec![ProjectSubjectInput {
                    subject: "initial".into(),
                }],
                language_pairs: vec![ProjectLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "fr".into(),
                }],
            },
        )
        .await
        .expect("expected project creation to succeed");

        let result = update_project(
            &pool,
            UpdateProjectArgs {
                project_uuid,
                project_name: None,
                project_status: None,
                user_uuid: None,
                client_uuid: None,
                r#type: None,
                notes: None,
                subjects: Some(vec![
                    ProjectSubjectInput {
                        subject: "duplicate".into(),
                    },
                    ProjectSubjectInput {
                        subject: "duplicate".into(),
                    },
                ]),
                language_pairs: None,
            },
        )
        .await;

        match result {
            Err(DbError::Sqlx(sqlx::Error::Database(_))) => {}
            other => panic!("expected duplicate subject violation, got {other:?}"),
        }

        let bundle = get_project(&pool, project_uuid)
            .await
            .expect("expected project fetch to succeed")
            .expect("project should still exist");
        let subjects: Vec<String> = bundle
            .subjects
            .into_iter()
            .map(|record| record.subject)
            .collect();
        assert_eq!(
            subjects,
            vec!["initial".to_string()],
            "original subjects should remain after rollback"
        );
    }

    #[tokio::test]
    async fn project_statistics_reflects_artifacts_and_jobs() {
        let pool = test_pool().await;
        let user_uuid = Uuid::new_v4();
        seed_user(&pool, user_uuid).await;

        let project_uuid = Uuid::new_v4();
        create_project(
            &pool,
            NewProjectArgs {
                project_uuid,
                project_name: "Stats project".into(),
                project_status: "active".into(),
                user_uuid,
                client_uuid: None,
                r#type: "standard".into(),
                notes: None,
                subjects: vec![],
                language_pairs: vec![ProjectLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "fr".into(),
                }],
            },
        )
        .await
        .expect("expected project creation to succeed");

        // Processable file with successful conversion
        let processable_file = Uuid::new_v4();
        attach_project_file(
            &pool,
            NewFileInfoArgs {
                file_uuid: processable_file,
                ext: "docx".into(),
                r#type: "processable".into(),
                size_bytes: Some(2_048),
                segment_count: Some(120),
                token_count: Some(3_400),
                notes: None,
            },
            NewProjectFileArgs {
                project_uuid,
                file_uuid: processable_file,
                filename: "ready.docx".into(),
                stored_at: "ready.docx".into(),
                r#type: "processable".into(),
                language_pairs: vec![FileLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "fr".into(),
                }],
            },
        )
        .await
        .expect("expected processable file attach to succeed");

        let completed_artifact = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO artifacts (
                artifact_uuid, project_uuid, file_uuid, artifact_type,
                size_bytes, segment_count, token_count, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'completed')
            "#,
        )
        .bind(completed_artifact)
        .bind(project_uuid)
        .bind(processable_file)
        .bind("xliff")
        .bind(Some(4096_i64))
        .bind(Some(120_i64))
        .bind(Some(3400_i64))
        .execute(&pool)
        .await
        .expect("expected artifact insert");

        sqlx::query(
            r#"
            INSERT INTO jobs (
                artifact_uuid, job_type, project_uuid, job_status, error_log
            ) VALUES (?1, 'convert', ?2, 'completed', NULL)
            "#,
        )
        .bind(completed_artifact)
        .bind(project_uuid)
        .execute(&pool)
        .await
        .expect("expected completed job insert");

        // Processable file with failed conversion/job
        let failing_file = Uuid::new_v4();
        attach_project_file(
            &pool,
            NewFileInfoArgs {
                file_uuid: failing_file,
                ext: "pdf".into(),
                r#type: "processable".into(),
                size_bytes: Some(5_120),
                segment_count: Some(10),
                token_count: Some(900),
                notes: None,
            },
            NewProjectFileArgs {
                project_uuid,
                file_uuid: failing_file,
                filename: "broken.pdf".into(),
                stored_at: "broken.pdf".into(),
                r#type: "processable".into(),
                language_pairs: vec![FileLanguagePairInput {
                    source_lang: "en".into(),
                    target_lang: "fr".into(),
                }],
            },
        )
        .await
        .expect("expected failing file attach to succeed");

        let failed_artifact = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO artifacts (
                artifact_uuid, project_uuid, file_uuid, artifact_type,
                size_bytes, segment_count, token_count, status
            ) VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, 'failed')
            "#,
        )
        .bind(failed_artifact)
        .bind(project_uuid)
        .bind(failing_file)
        .bind("xliff")
        .execute(&pool)
        .await
        .expect("expected failed artifact insert");

        sqlx::query(
            r#"
            INSERT INTO jobs (
                artifact_uuid, job_type, project_uuid, job_status, error_log
            ) VALUES (?1, 'convert', ?2, 'failed', 'conversion pipeline error')
            "#,
        )
        .bind(failed_artifact)
        .bind(project_uuid)
        .execute(&pool)
        .await
        .expect("expected failed job insert");

        // Reference file without conversions
        let reference_file = Uuid::new_v4();
        attach_project_file(
            &pool,
            NewFileInfoArgs {
                file_uuid: reference_file,
                ext: "pdf".into(),
                r#type: "reference".into(),
                size_bytes: Some(1_024),
                segment_count: None,
                token_count: None,
                notes: None,
            },
            NewProjectFileArgs {
                project_uuid,
                file_uuid: reference_file,
                filename: "brand.pdf".into(),
                stored_at: "brand.pdf".into(),
                r#type: "reference".into(),
                language_pairs: vec![],
            },
        )
        .await
        .expect("expected reference file attach to succeed");

        let stats = get_project_statistics(&pool, project_uuid)
            .await
            .expect("expected stats query to succeed")
            .expect("expected statistics to be present");

        assert_eq!(stats.totals.total, 3);
        assert_eq!(stats.totals.processable, 2);
        assert_eq!(stats.totals.reference, 1);
        assert_eq!(stats.totals.instructions, 0);
        assert_eq!(stats.totals.image, 0);

        assert_eq!(stats.conversions.total, 2);
        assert_eq!(stats.conversions.completed, 1);
        assert_eq!(stats.conversions.failed, 1);
        assert_eq!(stats.conversions.pending, 0);
        assert_eq!(stats.conversions.running, 0);
        assert_eq!(stats.conversions.other, 0);
        assert_eq!(stats.conversions.segments, 120);
        assert_eq!(stats.conversions.tokens, 3_400);

        assert_eq!(stats.jobs.total, 2);
        assert_eq!(stats.jobs.completed, 1);
        assert_eq!(stats.jobs.failed, 1);
        assert_eq!(stats.jobs.pending, 0);
        assert_eq!(stats.jobs.running, 0);
        assert_eq!(stats.jobs.other, 0);

        assert_eq!(stats.progress.processable_files, 2);
        assert_eq!(stats.progress.files_ready, 1);
        assert_eq!(stats.progress.files_with_errors, 1);
        assert!(
            (stats.progress.percent_complete - 50.0).abs() < f32::EPSILON,
            "expected 50% progress, got {}",
            stats.progress.percent_complete
        );

        assert_eq!(stats.warnings.failed_artifacts, 1);
        assert_eq!(stats.warnings.failed_jobs, 1);
        assert_eq!(stats.warnings.total, 2);
        assert!(
            stats.last_activity.is_some(),
            "expected last_activity to be set"
        );
    }
}

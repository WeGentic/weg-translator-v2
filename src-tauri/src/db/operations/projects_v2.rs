//! Project operations aligned with the new schema.

use sqlx::{QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::db::types::{
    FileInfoRecord, FileLanguagePairInput, FileLanguagePairRecord, NewFileInfoArgs, NewProjectArgs,
    NewProjectFileArgs, ProjectBundle, ProjectFileBundle, ProjectFileRecord,
    ProjectLanguagePairInput, ProjectLanguagePairRecord, ProjectRecord, ProjectSubjectInput,
    ProjectSubjectRecord, UpdateProjectArgs,
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

/// Lists project records without eager loading relations.
pub async fn list_projects(pool: &SqlitePool) -> DbResult<Vec<ProjectRecord>> {
    let rows: Vec<ProjectRecord> = sqlx::query_as(
        "SELECT * FROM projects ORDER BY creation_date DESC, project_name COLLATE NOCASE ASC",
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
}

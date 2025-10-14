use std::collections::HashSet;

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Row, SqlitePool};

#[tokio::test]
async fn migrations_create_expected_tables() -> Result<(), Box<dyn std::error::Error>> {
    let pool = migrated_pool().await?;

    let expected: HashSet<&str> = [
        "users",
        "clients",
        "domains",
        "project_language_pairs",
        "project_files",
        "file_targets",
        "artifacts",
        "validations",
        "notes",
        "jobs",
    ]
    .into_iter()
    .collect();

    let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type = 'table'")
        .fetch_all(&pool)
        .await?;

    let table_names: HashSet<String> = rows
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect();

    for table in expected {
        assert!(
            table_names.contains(table),
            "expected `{table}` table to exist after migrations"
        );
    }

    Ok(())
}

#[tokio::test]
async fn projects_table_enforces_owner_and_lifecycle() -> Result<(), Box<dyn std::error::Error>> {
    let pool = migrated_pool().await?;

    let columns = sqlx::query("PRAGMA table_info('projects')")
        .fetch_all(&pool)
        .await?;

    for required in [
        "owner_user_id",
        "client_id",
        "domain_id",
        "lifecycle_status",
        "archived_at",
    ] {
        assert!(
            columns
                .iter()
                .any(|row| row.get::<String, _>("name") == required),
            "expected `{required}` column on projects table"
        );
    }

    let foreign_keys = sqlx::query("PRAGMA foreign_key_list('projects')")
        .fetch_all(&pool)
        .await?;

    assert!(
        foreign_keys.iter().any(|row| {
            row.get::<String, _>("table") == "users"
                && row.get::<String, _>("from") == "owner_user_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("RESTRICT")
        }),
        "expected owner_user_id foreign key -> users with RESTRICT delete"
    );

    assert!(
        foreign_keys.iter().any(|row| {
            row.get::<String, _>("table") == "clients"
                && row.get::<String, _>("from") == "client_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("SET NULL")
        }),
        "expected client_id foreign key -> clients with SET NULL delete"
    );

    assert!(
        foreign_keys.iter().any(|row| {
            row.get::<String, _>("table") == "domains"
                && row.get::<String, _>("from") == "domain_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("SET NULL")
        }),
        "expected domain_id foreign key -> domains with SET NULL delete"
    );

    let project_sql: (String,) =
        sqlx::query_as("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'projects'")
            .fetch_one(&pool)
            .await?;
    let normalized = project_sql.0.to_uppercase();

    assert!(
        normalized.contains(
            "CHECK (LIFECYCLE_STATUS IN ('CREATING','READY','IN_PROGRESS','COMPLETED','ERROR'))"
        ),
        "expected lifecycle_status CHECK constraint"
    );

    let indexes = sqlx::query("PRAGMA index_list('projects')")
        .fetch_all(&pool)
        .await?;
    assert!(
        indexes.iter().any(|row| {
            row.get::<String, _>("name") == "ux_projects_owner_name"
                && row.get::<i64, _>("unique") == 1
        }),
        "expected unique index ux_projects_owner_name on projects"
    );

    let triggers = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'projects'",
    )
    .fetch_all(&pool)
    .await?;
    for trigger in [
        "trg_projects_updated_at",
        "trg_projects_owner_not_null_insert",
        "trg_projects_owner_not_null_update",
    ] {
        assert!(
            triggers
                .iter()
                .any(|row| row.get::<String, _>("name") == trigger),
            "expected `{trigger}` trigger on projects"
        );
    }

    Ok(())
}

#[tokio::test]
async fn project_files_and_targets_enforce_roles_and_statuses()
-> Result<(), Box<dyn std::error::Error>> {
    let pool = migrated_pool().await?;

    let file_sql: (String,) = sqlx::query_as(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_files'",
    )
    .fetch_one(&pool)
    .await?;
    let file_sql_upper = file_sql.0.to_uppercase();

    assert!(
        file_sql_upper.contains(
            "CHECK (ROLE IN ('SOURCE','REFERENCE','TM','TERMBASE','STYLEGUIDE','OTHER'))"
        ),
        "expected role CHECK constraint on project_files"
    );
    assert!(
        file_sql_upper.contains("CHECK (STORAGE_STATE IN ('STAGED','COPIED','MISSING','DELETED'))"),
        "expected storage_state CHECK constraint on project_files"
    );

    let unique_indexes = sqlx::query("PRAGMA index_list('project_files')")
        .fetch_all(&pool)
        .await?;
    assert!(
        unique_indexes.iter().any(|row| {
            row.get::<String, _>("name") == "ux_project_files_rel_path"
                && row.get::<i64, _>("unique") == 1
        }),
        "expected unique index ux_project_files_rel_path on project_files"
    );

    let target_sql: (String,) = sqlx::query_as(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'file_targets'",
    )
    .fetch_one(&pool)
    .await?;
    let target_sql_upper = target_sql.0.to_uppercase();
    assert!(
        target_sql_upper.contains("CHECK (STATUS IN ('PENDING','EXTRACTED','FAILED'))"),
        "expected status CHECK constraint on file_targets"
    );

    let target_fks = sqlx::query("PRAGMA foreign_key_list('file_targets')")
        .fetch_all(&pool)
        .await?;
    assert!(
        target_fks.iter().any(|row| {
            row.get::<String, _>("table") == "project_files"
                && row.get::<String, _>("from") == "file_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("CASCADE")
        }),
        "expected file_id foreign key -> project_files with CASCADE delete"
    );
    assert!(
        target_fks.iter().any(|row| {
            row.get::<String, _>("table") == "project_language_pairs"
                && row.get::<String, _>("from") == "pair_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("CASCADE")
        }),
        "expected pair_id foreign key -> project_language_pairs with CASCADE delete"
    );

    let target_triggers = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'file_targets'",
    )
    .fetch_all(&pool)
    .await?;
    assert!(
        target_triggers
            .iter()
            .any(|row| row.get::<String, _>("name") == "trg_file_targets_updated_at"),
        "expected trg_file_targets_updated_at trigger"
    );

    Ok(())
}

#[tokio::test]
async fn artifacts_and_jobs_schema_are_consistent() -> Result<(), Box<dyn std::error::Error>> {
    let pool = migrated_pool().await?;

    let artifacts_sql: (String,) =
        sqlx::query_as("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'")
            .fetch_one(&pool)
            .await?;
    let artifacts_sql_upper = artifacts_sql.0.to_uppercase();
    assert!(
        artifacts_sql_upper.contains("CHECK (KIND IN ('XLIFF','JLIFF','QA_REPORT','PREVIEW'))"),
        "expected kind CHECK constraint on artifacts"
    );
    assert!(
        artifacts_sql_upper.contains("CHECK (STATUS IN ('GENERATED','FAILED'))"),
        "expected status CHECK constraint on artifacts"
    );

    let artifact_fk = sqlx::query("PRAGMA foreign_key_list('artifacts')")
        .fetch_all(&pool)
        .await?;
    assert!(
        artifact_fk.iter().any(|row| {
            row.get::<String, _>("table") == "file_targets"
                && row.get::<String, _>("from") == "file_target_id"
                && row
                    .get::<String, _>("on_delete")
                    .eq_ignore_ascii_case("CASCADE")
        }),
        "expected file_target_id foreign key -> file_targets with CASCADE delete"
    );

    let artifacts_indexes = sqlx::query("PRAGMA index_list('artifacts')")
        .fetch_all(&pool)
        .await?;
    assert!(
        artifacts_indexes
            .iter()
            .any(|row| row.get::<String, _>("name") == "ix_artifacts_kind_path"),
        "expected ix_artifacts_kind_path index on artifacts"
    );

    let jobs_sql: (String,) =
        sqlx::query_as("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
            .fetch_one(&pool)
            .await?;
    let jobs_sql_upper = jobs_sql.0.to_uppercase();
    assert!(
        jobs_sql_upper.contains(
            "CHECK (JOB_TYPE IN ('COPY_FILE','EXTRACT_XLIFF','CONVERT_JLIFF','VALIDATE'))"
        ),
        "expected job_type CHECK constraint on jobs"
    );
    assert!(
        jobs_sql_upper
            .contains("CHECK (STATE IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED'))"),
        "expected state CHECK constraint on jobs"
    );
    assert!(
        jobs_sql_upper.contains("JOB_KEY TEXT"),
        "expected job_key column on jobs"
    );

    let jobs_indexes = sqlx::query("PRAGMA index_list('jobs')")
        .fetch_all(&pool)
        .await?;
    assert!(
        jobs_indexes.iter().any(|row| {
            row.get::<String, _>("name") == "ux_jobs_job_key" && row.get::<i64, _>("unique") == 1
        }),
        "expected unique index ux_jobs_job_key on jobs"
    );

    let job_triggers =
        sqlx::query("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'jobs'")
            .fetch_all(&pool)
            .await?;
    for trigger in [
        "trg_jobs_job_key_not_null_insert",
        "trg_jobs_job_key_not_null_update",
    ] {
        assert!(
            job_triggers
                .iter()
                .any(|row| row.get::<String, _>("name") == trigger),
            "expected `{trigger}` trigger on jobs"
        );
    }

    Ok(())
}

async fn migrated_pool() -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(":memory:")
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

//! Programmatic schema bootstrap for the development SQLite database.
//!
//! The schema here mirrors the latest development layout that was previously
//! managed via SQLx migrations. Each statement is idempotent so the bootstrap
//! can be safely executed on every launch.

use sqlx::Error as SqlxError;
use sqlx::{Executor, Sqlite, SqlitePool, Transaction};

const CORE_TABLE_STATEMENTS: &[&str] = &[
    // Translation history (legacy playground, kept for completeness).
    r#"
    CREATE TABLE IF NOT EXISTS translation_jobs (
        id TEXT PRIMARY KEY,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        input_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        stage TEXT NOT NULL DEFAULT 'received',
        progress REAL NOT NULL DEFAULT 0.0,
        queued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        failure_reason TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK(progress >= 0.0 AND progress <= 1.0),
        CHECK(status IN ('queued', 'running', 'completed', 'failed')),
        CHECK(stage IN ('received', 'preparing', 'translating', 'completed', 'failed'))
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS translation_outputs (
        job_id TEXT PRIMARY KEY,
        output_text TEXT NOT NULL,
        model_name TEXT,
        input_token_count INTEGER DEFAULT 0,
        output_token_count INTEGER DEFAULT 0,
        total_token_count INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY(job_id) REFERENCES translation_jobs(id) ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS clients (
        client_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS domains (
        domain_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        project_type TEXT NOT NULL CHECK (project_type IN ('translation','rag')),
        root_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
        owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        client_id TEXT REFERENCES clients(client_id) ON DELETE SET NULL,
        domain_id TEXT REFERENCES domains(domain_id) ON DELETE SET NULL,
        lifecycle_status TEXT NOT NULL DEFAULT 'CREATING'
            CHECK (lifecycle_status IN ('CREATING','READY','IN_PROGRESS','COMPLETED','ERROR')),
        archived_at TEXT,
        default_src_lang TEXT,
        default_tgt_lang TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_language_pairs (
        pair_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        src_lang TEXT NOT NULL,
        trg_lang TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(project_id, src_lang, trg_lang)
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        original_path TEXT NOT NULL,
        stored_rel_path TEXT NOT NULL,
        ext TEXT NOT NULL,
        size_bytes INTEGER,
        checksum_sha256 TEXT,
        hash_sha256 TEXT,
        import_status TEXT NOT NULL DEFAULT 'imported'
            CHECK (import_status IN ('imported','failed')),
        role TEXT NOT NULL DEFAULT 'source'
            CHECK (role IN ('source','reference','tm','termbase','styleguide','other')),
        mime_type TEXT,
        storage_state TEXT NOT NULL DEFAULT 'COPIED'
            CHECK (storage_state IN ('STAGED','COPIED','MISSING','DELETED')),
        importer TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, stored_rel_path)
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_file_conversions (
        id TEXT PRIMARY KEY,
        project_file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        src_lang TEXT NOT NULL,
        tgt_lang TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '2.1'
            CHECK (version IN ('2.0','2.1','2.2')),
        paragraph INTEGER NOT NULL DEFAULT 1 CHECK (paragraph IN (0,1)),
        embed INTEGER NOT NULL DEFAULT 1 CHECK (embed IN (0,1)),
        xliff_rel_path TEXT,
        jliff_rel_path TEXT,
        tag_map_rel_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending','running','completed','failed')),
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_file_id, src_lang, tgt_lang, version)
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS file_targets (
        file_target_id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        pair_id TEXT NOT NULL REFERENCES project_language_pairs(pair_id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING','EXTRACTED','FAILED')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(file_id, pair_id)
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS artifacts (
        artifact_id TEXT PRIMARY KEY,
        file_target_id TEXT NOT NULL REFERENCES file_targets(file_target_id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('xliff','jliff','qa_report','preview')),
        rel_path TEXT NOT NULL,
        size_bytes INTEGER,
        checksum TEXT,
        tool TEXT,
        status TEXT NOT NULL DEFAULT 'GENERATED'
            CHECK (status IN ('GENERATED','FAILED')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(file_target_id, kind)
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS validations (
        validation_id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
        validator TEXT NOT NULL,
        passed INTEGER NOT NULL CHECK (passed IN (0,1)),
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS notes (
        note_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        job_type TEXT NOT NULL CHECK (job_type IN ('COPY_FILE','EXTRACT_XLIFF','CONVERT_JLIFF','VALIDATE')),
        job_key TEXT NOT NULL,
        file_target_id TEXT REFERENCES file_targets(file_target_id) ON DELETE CASCADE,
        artifact_id TEXT REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
        state TEXT NOT NULL DEFAULT 'PENDING'
            CHECK (state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        started_at TEXT,
        finished_at TEXT
    )
    "#,
];

const INDEX_AND_TRIGGER_STATEMENTS: &[&str] = &[
    r#"CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_translation_jobs_created_at ON translation_jobs(created_at)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_translation_outputs_created_at ON translation_outputs(created_at)"#,
    r#"CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug)"#,
    r#"CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_owner_name ON projects(owner_user_id, name COLLATE NOCASE) WHERE archived_at IS NULL"#,
    r#"CREATE INDEX IF NOT EXISTS idx_projects_default_lang ON projects(default_src_lang, default_tgt_lang)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_project_file_conversions_status ON project_file_conversions(status)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_project_file_conversions_file ON project_file_conversions(project_file_id)"#,
    r#"CREATE INDEX IF NOT EXISTS ix_jobs_project_state ON jobs(project_id, state)"#,
    r#"CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_job_key ON jobs(job_key)"#,
    r#"CREATE INDEX IF NOT EXISTS ix_artifacts_kind_path ON artifacts(kind, rel_path)"#,
    r#"
    CREATE TRIGGER IF NOT EXISTS trg_projects_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    BEGIN
      UPDATE projects
        SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = NEW.id
        AND updated_at = OLD.updated_at;
    END
    "#,
    r#"
    CREATE TRIGGER IF NOT EXISTS trg_file_targets_updated_at
    AFTER UPDATE ON file_targets
    FOR EACH ROW
    BEGIN
      UPDATE file_targets
        SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE file_target_id = NEW.file_target_id
        AND updated_at = OLD.updated_at;
    END
    "#,
    r#"
    CREATE TRIGGER IF NOT EXISTS trg_artifacts_updated_at
    AFTER UPDATE ON artifacts
    FOR EACH ROW
    BEGIN
      UPDATE artifacts
        SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE artifact_id = NEW.artifact_id
        AND updated_at = OLD.updated_at;
    END
    "#,
];

/// Ensures the development schema exists by executing idempotent creation statements.
pub async fn initialise_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    ensure_schema(&mut tx).await?;
    tx.commit().await
}

async fn ensure_schema(tx: &mut Transaction<'_, Sqlite>) -> Result<(), sqlx::Error> {
    for statement in CORE_TABLE_STATEMENTS {
        tx.execute(sqlx::query(statement)).await?;
    }

    for statement in INDEX_AND_TRIGGER_STATEMENTS {
        tx.execute(sqlx::query(statement)).await?;
    }

    // Backward compatibility: add columns that may be missing from legacy databases.
    add_column_if_missing(tx, "project_files", "hash_sha256 TEXT").await?;
    add_column_if_missing(tx, "project_file_conversions", "jliff_rel_path TEXT").await?;
    add_column_if_missing(tx, "project_file_conversions", "tag_map_rel_path TEXT").await?;

    // Seed the default local owner expected by the rest of the application.
    tx.execute(sqlx::query(
        r#"
        INSERT OR IGNORE INTO users (user_id, email, display_name)
        VALUES ('local-user', 'local@localhost', 'Local Owner')
        "#,
    ))
    .await?;

    Ok(())
}

async fn add_column_if_missing(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    column_definition: &str,
) -> Result<(), sqlx::Error> {
    let statement = format!("ALTER TABLE {table} ADD COLUMN {column_definition}");
    match tx.execute(sqlx::query(&statement)).await {
        Ok(_) => Ok(()),
        Err(SqlxError::Database(db_error))
            if db_error.message().contains("duplicate column name") =>
        {
            Ok(())
        }
        Err(err) => Err(err),
    }
}

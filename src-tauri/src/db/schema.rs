//! Programmatic schema bootstrap for the development SQLite database.
//!
//! The schema here mirrors the latest development layout that was previously
//! managed via SQLx migrations. Each statement is idempotent so the bootstrap
//! can be safely executed on every launch.

use sqlx::{Executor, Sqlite, SqlitePool, Transaction};

const TABLE_STATEMENTS: &[&str] = &[
    r#"
    CREATE TABLE IF NOT EXISTS users (
        user_uuid TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS user_roles (
        user_uuid TEXT NOT NULL,
        role TEXT NOT NULL,
        PRIMARY KEY (user_uuid, role),
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
        user_uuid TEXT NOT NULL,
        permission TEXT NOT NULL,
        is_allowed INTEGER NOT NULL DEFAULT 1 CHECK (is_allowed IN (0, 1)),
        PRIMARY KEY (user_uuid, permission),
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS clients (
        client_uuid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        vat_number TEXT,
        note TEXT
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS projects (
        project_uuid TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        creation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        project_status TEXT NOT NULL,
        user_uuid TEXT NOT NULL,
        client_uuid TEXT,
        type TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (client_uuid) REFERENCES clients(client_uuid) ON UPDATE CASCADE ON DELETE SET NULL
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_subjects (
        project_uuid TEXT NOT NULL,
        subject TEXT NOT NULL,
        PRIMARY KEY (project_uuid, subject),
        FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_language_pairs (
        project_uuid TEXT NOT NULL,
        source_lang TEXT NOT NULL,
        target_lang TEXT NOT NULL,
        PRIMARY KEY (project_uuid, source_lang, target_lang),
        FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS file_info (
        file_uuid TEXT PRIMARY KEY,
        ext TEXT NOT NULL,
        type TEXT NOT NULL,
        size_bytes INTEGER,
        segment_count INTEGER,
        token_count INTEGER,
        notes TEXT
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS project_files (
        project_uuid TEXT NOT NULL,
        file_uuid TEXT NOT NULL,
        filename TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        type TEXT NOT NULL,
        PRIMARY KEY (project_uuid, file_uuid),
        FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (file_uuid) REFERENCES file_info(file_uuid) ON UPDATE CASCADE ON DELETE RESTRICT
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS file_language_pairs (
        project_uuid TEXT NOT NULL,
        file_uuid TEXT NOT NULL,
        source_lang TEXT NOT NULL,
        target_lang TEXT NOT NULL,
        PRIMARY KEY (project_uuid, file_uuid, source_lang, target_lang),
        FOREIGN KEY (project_uuid, file_uuid) REFERENCES project_files(project_uuid, file_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS artifacts (
        artifact_uuid TEXT PRIMARY KEY,
        project_uuid TEXT NOT NULL,
        file_uuid TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        size_bytes INTEGER,
        segment_count INTEGER,
        token_count INTEGER,
        status TEXT NOT NULL,
        FOREIGN KEY (project_uuid, file_uuid) REFERENCES project_files(project_uuid, file_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS jobs (
        artifact_uuid TEXT NOT NULL,
        job_type TEXT NOT NULL,
        project_uuid TEXT NOT NULL,
        job_status TEXT NOT NULL,
        error_log TEXT,
        PRIMARY KEY (artifact_uuid, job_type),
        FOREIGN KEY (artifact_uuid) REFERENCES artifacts(artifact_uuid) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON UPDATE CASCADE ON DELETE CASCADE
    )
    "#,
];

const INDEX_STATEMENTS: &[&str] = &[
    r#"CREATE INDEX IF NOT EXISTS idx_project_language_pairs_project ON project_language_pairs(project_uuid)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_uuid)"#,
    r#"CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_uuid)"#,
    r#"CREATE UNIQUE INDEX IF NOT EXISTS ux_artifacts_project_artifact ON artifacts(project_uuid, artifact_uuid)"#,
];

const TRIGGER_STATEMENTS: &[&str] = &[
    r#"
    CREATE TRIGGER IF NOT EXISTS projects_set_update_date
    AFTER UPDATE ON projects
    FOR EACH ROW
    WHEN NEW.update_date = OLD.update_date
    BEGIN
        UPDATE projects
        SET update_date = CURRENT_TIMESTAMP
        WHERE project_uuid = NEW.project_uuid
          AND update_date = OLD.update_date;
    END
    "#,
    r#"
    CREATE TRIGGER IF NOT EXISTS flp_must_be_subset_of_plp_insert
    BEFORE INSERT ON file_language_pairs
    FOR EACH ROW
    WHEN NOT EXISTS (
        SELECT 1
        FROM project_language_pairs
        WHERE project_uuid = NEW.project_uuid
          AND source_lang = NEW.source_lang
          AND target_lang = NEW.target_lang
    )
    BEGIN
        SELECT RAISE(
            ABORT,
            'file language pair must match existing project language pair'
        );
    END
    "#,
    r#"
    CREATE TRIGGER IF NOT EXISTS flp_must_be_subset_of_plp_update
    BEFORE UPDATE ON file_language_pairs
    FOR EACH ROW
    WHEN NOT EXISTS (
        SELECT 1
        FROM project_language_pairs
        WHERE project_uuid = NEW.project_uuid
          AND source_lang = NEW.source_lang
          AND target_lang = NEW.target_lang
    )
    BEGIN
        SELECT RAISE(
            ABORT,
            'file language pair must match existing project language pair'
        );
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
    for statement in TABLE_STATEMENTS {
        tx.execute(sqlx::query(statement)).await?;
    }

    for statement in INDEX_STATEMENTS {
        tx.execute(sqlx::query(statement)).await?;
    }

    for statement in TRIGGER_STATEMENTS {
        tx.execute(sqlx::query(statement)).await?;
    }

    Ok(())
}

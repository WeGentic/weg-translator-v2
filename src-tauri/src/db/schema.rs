//! Schema bootstrap that proxies to the embedded SQLx migrator.
//!
//! The historic hand-written schema initialiser has been replaced with versioned
//! migrations in `src-tauri/migrations`. Tests and consumers should continue
//! calling `initialise_schema`, which now simply runs the embedded migrator.

use sqlx::{SqlitePool, migrate::Migrator};

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Applies any pending migrations against the provided pool.
pub async fn initialise_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    MIGRATOR.run(pool).await.map_err(Into::into)
}

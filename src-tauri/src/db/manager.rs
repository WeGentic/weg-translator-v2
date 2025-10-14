//! Core database manager responsible for owning the SQLite pool.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use tokio::sync::{Mutex, RwLock};

use super::config::DatabasePerformanceConfig;
use super::constants::{MIGRATOR, SQLITE_DB_FILE};
use super::error::DbResult;

/// Central entry-point for all database interactions. Wraps the SQLite pool and synchronises writes.
#[derive(Clone)]
pub struct DbManager {
    pub(crate) pool: Arc<RwLock<SqlitePool>>,
    pub(crate) write_lock: Arc<Mutex<()>>,
    performance: DatabasePerformanceConfig,
}

impl DbManager {
    /// Creates a manager using the application data directory as the database root.
    pub async fn new_with_base_dir(base_dir: &Path) -> DbResult<Self> {
        Self::new_with_base_dir_and_performance(base_dir, DatabasePerformanceConfig::default())
            .await
    }

    /// Creates a manager using the specified performance configuration for PRAGMA overrides.
    pub async fn new_with_base_dir_and_performance(
        base_dir: &Path,
        performance: DatabasePerformanceConfig,
    ) -> DbResult<Self> {
        fs::create_dir_all(base_dir)?;
        let pool = Self::connect_pool(base_dir, performance).await?;
        Ok(Self {
            pool: Arc::new(RwLock::new(pool)),
            write_lock: Arc::new(Mutex::new(())),
            performance,
        })
    }

    /// Uses an existing pool, primarily for tests.
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self {
            pool: Arc::new(RwLock::new(pool)),
            write_lock: Arc::new(Mutex::new(())),
            performance: DatabasePerformanceConfig::default(),
        }
    }

    /// Returns a cloned handle to the current pool.
    pub(crate) async fn pool(&self) -> SqlitePool {
        self.pool.read().await.clone()
    }

    async fn connect_pool(
        base_dir: &Path,
        performance: DatabasePerformanceConfig,
    ) -> Result<SqlitePool, sqlx::Error> {
        let db_path = base_dir.join(SQLITE_DB_FILE);
        let connection_url = format!("sqlite://{}", db_path.to_string_lossy());
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&connection_url)
            .await?;
        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await?;
        let journal_mode = format!(
            "PRAGMA journal_mode = {};",
            performance.journal_mode().as_str()
        );
        sqlx::query(&journal_mode).execute(&pool).await?;
        let synchronous = format!(
            "PRAGMA synchronous = {};",
            performance.synchronous().as_str()
        );
        sqlx::query(&synchronous).execute(&pool).await?;
        MIGRATOR.run(&pool).await?;
        Ok(pool)
    }

    /// Reopens the database using the provided base directory, swapping the pool atomically.
    pub async fn reopen_with_base_dir(&self, base_dir: &Path) -> DbResult<()> {
        fs::create_dir_all(base_dir)?;
        let performance = self.performance;
        let new_pool = Self::connect_pool(base_dir, performance).await?;
        let _guard = self.write_lock.lock().await;
        let mut writer = self.pool.write().await;
        let old_pool = std::mem::replace(&mut *writer, new_pool);
        drop(writer);
        old_pool.close().await;
        Ok(())
    }
}

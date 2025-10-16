//! Core database manager responsible for owning the SQLite pool.
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::Arc;

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use super::config::DatabasePerformanceConfig;
use super::constants::SQLITE_DB_FILE;
use super::error::DbResult;
use super::operations::{artifacts_v2, clients, jobs_v2, projects_v2, users};
use super::schema::initialise_schema;
use super::types::{
    ArtifactRecord, ClientRecord, JobRecord, NewArtifactArgs, NewClientArgs, NewFileInfoArgs,
    NewJobArgs, NewProjectArgs, NewProjectFileArgs, NewUserArgs, ProjectBundle, ProjectFileBundle,
    ProjectRecord, UpdateArtifactStatusArgs, UpdateClientArgs, UpdateJobStatusArgs,
    UpdateProjectArgs, UpdateUserArgs, UserProfile,
};

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
        match fs::remove_file(&db_path) {
            Ok(()) => {
                log::info!(
                    target: "db::manager",
                    "removed existing database at {} before bootstrap",
                    db_path.display()
                );
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                log::debug!(
                    target: "db::manager",
                    "no existing database found at {}, starting fresh",
                    db_path.display()
                );
            }
            Err(error) => {
                return Err(sqlx::Error::Io(error));
            }
        }
        let mut connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);
        connect_options = connect_options.foreign_keys(true);

        let journal_mode_stmt = Arc::new(format!(
            "PRAGMA journal_mode = {};",
            performance.journal_mode().as_str()
        ));
        let synchronous_stmt = Arc::new(format!(
            "PRAGMA synchronous = {};",
            performance.synchronous().as_str()
        ));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .after_connect({
                let journal_mode_stmt = Arc::clone(&journal_mode_stmt);
                let synchronous_stmt = Arc::clone(&synchronous_stmt);
                move |conn, _meta| {
                    let journal_mode_stmt = Arc::clone(&journal_mode_stmt);
                    let synchronous_stmt = Arc::clone(&synchronous_stmt);
                    Box::pin(async move {
                        sqlx::query("PRAGMA foreign_keys = ON;")
                            .execute(&mut *conn)
                            .await?;
                        sqlx::query("PRAGMA recursive_triggers = OFF;")
                            .execute(&mut *conn)
                            .await?;
                        sqlx::query(&journal_mode_stmt).execute(&mut *conn).await?;
                        sqlx::query(&synchronous_stmt).execute(&mut *conn).await?;
                        Ok(())
                    })
                }
            })
            .connect_with(connect_options)
            .await?;
        initialise_schema(&pool).await?;
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

    /// Creates a new user profile.
    pub async fn create_user_profile(&self, args: NewUserArgs) -> DbResult<UserProfile> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        users::create_user(&pool, args).await
    }

    /// Updates an existing user profile.
    pub async fn update_user_profile(&self, args: UpdateUserArgs) -> DbResult<Option<UserProfile>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        users::update_user(&pool, args).await
    }

    /// Deletes a user.
    pub async fn delete_user_profile(&self, user_uuid: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        users::delete_user(&pool, user_uuid).await
    }

    /// Retrieves a single user profile.
    pub async fn get_user_profile(&self, user_uuid: Uuid) -> DbResult<Option<UserProfile>> {
        let pool = self.pool().await;
        users::get_user(&pool, user_uuid).await
    }

    /// Lists all user profiles.
    pub async fn list_user_profiles(&self) -> DbResult<Vec<UserProfile>> {
        let pool = self.pool().await;
        users::list_users(&pool).await
    }

    /// Creates a client record.
    pub async fn create_client_record(&self, args: NewClientArgs) -> DbResult<ClientRecord> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        clients::create_client(&pool, args).await
    }

    /// Updates a client record.
    pub async fn update_client_record(
        &self,
        args: UpdateClientArgs,
    ) -> DbResult<Option<ClientRecord>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        clients::update_client(&pool, args).await
    }

    /// Deletes a client record.
    pub async fn delete_client_record(&self, client_uuid: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        clients::delete_client(&pool, client_uuid).await
    }

    /// Retrieves a client record.
    pub async fn get_client_record(&self, client_uuid: Uuid) -> DbResult<Option<ClientRecord>> {
        let pool = self.pool().await;
        clients::get_client(&pool, client_uuid).await
    }

    /// Lists clients ordered by name.
    pub async fn list_client_records(&self) -> DbResult<Vec<ClientRecord>> {
        let pool = self.pool().await;
        clients::list_clients(&pool).await
    }

    /// Creates a new project bundle with subjects and language pairs.
    pub async fn create_project_bundle(&self, args: NewProjectArgs) -> DbResult<ProjectBundle> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        projects_v2::create_project(&pool, args).await
    }

    /// Updates an existing project bundle.
    pub async fn update_project_bundle(
        &self,
        args: UpdateProjectArgs,
    ) -> DbResult<Option<ProjectBundle>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        projects_v2::update_project(&pool, args).await
    }

    /// Deletes a project.
    pub async fn delete_project_bundle(&self, project_uuid: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        projects_v2::delete_project(&pool, project_uuid).await
    }

    /// Retrieves a project bundle by identifier.
    pub async fn get_project_bundle(&self, project_uuid: Uuid) -> DbResult<Option<ProjectBundle>> {
        let pool = self.pool().await;
        projects_v2::get_project(&pool, project_uuid).await
    }

    /// Lists project records.
    pub async fn list_project_records(&self) -> DbResult<Vec<ProjectRecord>> {
        let pool = self.pool().await;
        projects_v2::list_projects(&pool).await
    }

    /// Attaches file metadata and link to a project.
    pub async fn attach_project_file(
        &self,
        file_info: NewFileInfoArgs,
        link: NewProjectFileArgs,
    ) -> DbResult<ProjectFileBundle> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        projects_v2::attach_project_file(&pool, file_info, link).await
    }

    /// Detaches a file from its project.
    pub async fn detach_project_file(&self, project_uuid: Uuid, file_uuid: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        projects_v2::detach_project_file(&pool, project_uuid, file_uuid).await
    }

    /// Upserts an artifact record.
    pub async fn upsert_artifact_record(&self, args: NewArtifactArgs) -> DbResult<ArtifactRecord> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        artifacts_v2::upsert_artifact(&pool, args).await
    }

    /// Updates artifact status metrics.
    pub async fn update_artifact_status(
        &self,
        args: UpdateArtifactStatusArgs,
    ) -> DbResult<Option<ArtifactRecord>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        artifacts_v2::update_artifact_status(&pool, args).await
    }

    /// Deletes an artifact.
    pub async fn delete_artifact_record(&self, artifact_uuid: Uuid) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        artifacts_v2::delete_artifact(&pool, artifact_uuid).await
    }

    /// Lists artifacts for a project file.
    pub async fn list_artifacts_for_file(
        &self,
        project_uuid: Uuid,
        file_uuid: Uuid,
    ) -> DbResult<Vec<ArtifactRecord>> {
        let pool = self.pool().await;
        artifacts_v2::list_artifacts_for_file(&pool, project_uuid, file_uuid).await
    }

    /// Upserts a job record.
    pub async fn upsert_job_record(&self, args: NewJobArgs) -> DbResult<JobRecord> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        jobs_v2::upsert_job(&pool, args).await
    }

    /// Updates job status.
    pub async fn update_job_status_record(
        &self,
        args: UpdateJobStatusArgs,
    ) -> DbResult<Option<JobRecord>> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        jobs_v2::update_job_status(&pool, args).await
    }

    /// Deletes a job entry.
    pub async fn delete_job_record(&self, artifact_uuid: Uuid, job_type: &str) -> DbResult<()> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        jobs_v2::delete_job(&pool, artifact_uuid, job_type).await
    }

    /// Lists jobs associated with a project.
    pub async fn list_jobs_for_project(&self, project_uuid: Uuid) -> DbResult<Vec<JobRecord>> {
        let pool = self.pool().await;
        jobs_v2::list_jobs_for_project(&pool, project_uuid).await
    }
}

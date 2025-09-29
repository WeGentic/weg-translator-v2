use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use log::{error, warn};
use tokio::{fs, sync::Mutex as AsyncMutex};

use crate::ipc::error::IpcError;

/// Global async mutex type used to guard exclusive file access while we update
/// artifacts on disk.
pub(crate) type FileLock = Arc<AsyncMutex<()>>;

struct FileLockRegistry {
    locks: AsyncMutex<HashMap<PathBuf, FileLock>>,
}

impl FileLockRegistry {
    fn new() -> Self {
        Self {
            locks: AsyncMutex::new(HashMap::new()),
        }
    }

    /// Returns (and creates if necessary) the mutex associated with a specific
    /// file path. Using a registry avoids keeping a huge map of locks eagerly in
    /// memory while still deduplicating locks per path.
    async fn lock_for_path(&self, path: &Path) -> FileLock {
        let mut map = self.locks.lock().await;
        Arc::clone(
            map.entry(path.to_path_buf())
                .or_insert_with(|| Arc::new(AsyncMutex::new(()))),
        )
    }
}

static FILE_LOCKS: OnceLock<FileLockRegistry> = OnceLock::new();

fn file_lock_registry() -> &'static FileLockRegistry {
    FILE_LOCKS.get_or_init(FileLockRegistry::new)
}

/// Runs asynchronous work while holding the mutex dedicated to a specific file
/// path. This prevents concurrent edits to the same artifact from racing each
/// other and corrupting JLIFF files.
pub async fn with_project_file_lock<F, Fut, T>(path: &Path, work: F) -> T
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = T>,
{
    let lock = file_lock_registry().lock_for_path(path).await;
    let _guard = lock.lock().await;
    work().await
}

/// Safe async wrapper around `tokio::fs::try_exists` that logs failures instead
/// of bubbling them to higher layers. We intentionally swallow the error to
/// avoid breaking settings views when the filesystem is transiently unavailable.
pub(crate) async fn path_exists_bool(path: &Path) -> bool {
    match fs::try_exists(path).await {
        Ok(result) => result,
        Err(error) => {
            warn!(
                target: "ipc::settings",
                "failed to probe path existence for {:?}: {error}",
                path
            );
            false
        }
    }
}

/// Returns whether a directory contains any entries. The helper mirrors the
/// synchronous `read_dir`/`next()` dance but keeps everything async friendly so
/// we do not block the runtime during folder validation.
pub(crate) async fn directory_is_empty(path: &Path) -> Result<bool, std::io::Error> {
    let mut entries = fs::read_dir(path).await?;
    Ok(entries.next_entry().await?.is_none())
}

/// Wraps low-level `std::io::Error` values into the domain-specific `IpcError`
/// while emitting a structured log. This ensures the UI receives a consistent
/// error message even when the underlying OS error differs per platform.
pub(crate) fn fs_error(action: &str, error: std::io::Error) -> IpcError {
    error!(
        target: "ipc::settings",
        "filesystem error while attempting to {action}: {error}"
    );
    IpcError::Internal("File system operation failed. Check folder permissions and retry.".into())
}

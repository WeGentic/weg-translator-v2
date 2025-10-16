mod artifacts_v2;
mod clients_v2;
mod jobs_v2;
mod projects_v2;
mod settings;
mod shared;
mod translations;
mod users_v2;

pub use settings::{
    get_app_settings, path_exists, update_app_folder, update_auto_convert_on_open,
    update_default_languages, update_max_parallel_conversions, update_notifications, update_theme,
    update_ui_language, update_xliff_version,
};
pub use shared::with_project_file_lock;
pub use translations::{
    clear_translation_history, fail_translation, get_translation_job, list_active_jobs,
    list_translation_history, start_translation,
};

pub use artifacts_v2::{
    delete_artifact_record_v2, list_artifacts_for_file_v2, update_artifact_status_v2,
    upsert_artifact_record_v2,
};
pub use clients_v2::{
    create_client_record_v2, delete_client_record_v2, get_client_record_v2, list_client_records_v2,
    update_client_record_v2,
};
pub use jobs_v2::{
    delete_job_record_v2, list_jobs_for_project_v2, update_job_status_v2, upsert_job_record_v2,
};
pub use projects_v2::{
    attach_project_file_v2, create_project_bundle_v2, delete_project_bundle_v2,
    detach_project_file_v2, get_project_bundle_v2, list_project_records_v2,
    update_project_bundle_v2,
};
pub use users_v2::{
    create_user_profile_v2, delete_user_profile_v2, get_user_profile_v2, list_user_profiles_v2,
    update_user_profile_v2,
};

use log::debug;

use super::dto::AppHealthReport;

/// Returns compile-time metadata about the backend. This command is handy for
/// support diagnostics and ensures the renderer can display version info.
#[tauri::command]
pub async fn health_check() -> AppHealthReport {
    debug!(target: "ipc::commands::health", "health_check requested");
    AppHealthReport {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
    }
}

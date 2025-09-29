mod projects;
mod settings;
mod shared;
mod translations;

#[allow(unused_imports)]
pub use projects::{JliffConversionResultDto, UpdateJliffSegmentResultDto};
pub use projects::{
    add_files_to_project, convert_xliff_to_jliff, create_project_with_files, delete_project,
    ensure_project_conversions_plan, get_project_details, list_projects, read_project_artifact,
    read_project_artifact_impl, remove_project_file, update_conversion_status,
    update_jliff_segment, update_jliff_segment_impl,
};
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

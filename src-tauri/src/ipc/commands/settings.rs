use std::path::{Path, PathBuf};

use log::{error, warn};
use tauri::{AppHandle, Manager, State};
use tokio::fs;

use super::shared::{directory_is_empty, fs_error, path_exists_bool};
use crate::db::{DbManager, SQLITE_DB_FILE};
use crate::ipc::dto::AppSettingsDto;
use crate::ipc::error::{IpcError, IpcResult};
use crate::ipc::state::TranslationState;
use crate::settings::{SettingsManager, move_directory};

/// Builds the DTO consumed by the front-end settings panel. The helper inspects
/// both the persisted configuration and the filesystem to provide actionable
/// status flags to the UI.
pub(super) async fn build_app_settings_dto(
    app: &AppHandle,
    settings: &SettingsManager,
) -> Result<AppSettingsDto, IpcError> {
    let current = settings.current().await;
    let app_folder = current.app_folder.clone();
    let database_path = current.database_path(SQLITE_DB_FILE);
    let projects_path = current.projects_dir();
    let settings_file = settings.file_path().to_path_buf();

    let default_app_folder = app.path().app_data_dir().map_err(|error| {
        error!(
            target: "ipc::settings",
            "failed to resolve default app data directory: {error}"
        );
        IpcError::Internal("Unable to resolve application data directory.".into())
    })?;

    let app_folder_exists = path_exists_bool(&app_folder).await;
    let database_exists = path_exists_bool(&database_path).await;
    let projects_path_exists = path_exists_bool(&projects_path).await;
    let settings_file_exists = settings_file.exists();

    Ok(AppSettingsDto {
        app_folder: app_folder.to_string_lossy().into_owned(),
        app_folder_exists,
        database_path: database_path.to_string_lossy().into_owned(),
        database_exists,
        projects_path: projects_path.to_string_lossy().into_owned(),
        projects_path_exists,
        settings_file: settings_file.to_string_lossy().into_owned(),
        settings_file_exists,
        default_app_folder: default_app_folder.to_string_lossy().into_owned(),
        is_using_default_location: app_folder == default_app_folder,
        auto_convert_on_open: current.auto_convert_on_open,
        theme: current.theme,
        ui_language: current.ui_language,
        default_source_language: current.default_source_language,
        default_target_language: current.default_target_language,
        default_xliff_version: current.default_xliff_version,
        show_notifications: current.show_notifications,
        enable_sound_notifications: current.enable_sound_notifications,
        max_parallel_conversions: current.max_parallel_conversions,
        database_journal_mode: current.database_journal_mode,
        database_synchronous: current.database_synchronous,
    })
}

/// Returns the current application settings while augmenting the response with
/// filesystem health checks.
#[tauri::command]
pub async fn get_app_settings(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
) -> IpcResult<AppSettingsDto> {
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

/// Moves the application data folder to a new location. The function performs
/// several guard checks to protect user data and ensures we roll back
/// gracefully if the database fails to reopen.
#[tauri::command]
pub async fn update_app_folder(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    db: State<'_, DbManager>,
    translation_state: State<'_, TranslationState>,
    new_folder: String,
) -> IpcResult<AppSettingsDto> {
    let candidate_raw = new_folder.trim();
    if candidate_raw.is_empty() {
        return Err(IpcError::Validation("Select a destination folder.".into()).into());
    }

    let candidate_path = PathBuf::from(candidate_raw);
    if !candidate_path.is_absolute() {
        return Err(IpcError::Validation(
            "Select an absolute path for the application folder.".into(),
        )
        .into());
    }

    if !translation_state.snapshot().is_empty() {
        return Err(IpcError::Validation(
            "Finish or cancel active translation jobs before moving the application folder.".into(),
        )
        .into());
    }

    let current_settings = settings.current().await;
    if candidate_path == current_settings.app_folder {
        return build_app_settings_dto(&app, &settings)
            .await
            .map_err(Into::into);
    }

    if candidate_path.starts_with(&current_settings.app_folder)
        || current_settings.app_folder.starts_with(&candidate_path)
    {
        return Err(IpcError::Validation(
            "Select a folder that is not nested within the current application directory.".into(),
        )
        .into());
    }

    if let Some(parent) = candidate_path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| fs_error("prepare parent directories", error))?;
    }

    let destination_exists = path_exists_bool(&candidate_path).await;
    if destination_exists {
        let metadata = fs::metadata(&candidate_path)
            .await
            .map_err(|error| fs_error("inspect destination folder", error))?;
        if !metadata.is_dir() {
            return Err(IpcError::Validation(
                "The selected path points to a file. Choose a folder instead.".into(),
            )
            .into());
        }

        let is_empty = directory_is_empty(&candidate_path)
            .await
            .map_err(|error| fs_error("inspect destination folder contents", error))?;
        if !is_empty {
            return Err(IpcError::Validation(
                "Choose an empty folder or remove its contents before moving the data.".into(),
            )
            .into());
        }

        fs::remove_dir(&candidate_path)
            .await
            .map_err(|error| fs_error("prepare destination directory", error))?;
    }

    match move_directory(&current_settings.app_folder, &candidate_path).await {
        Ok(_) => {}
        Err(error) => {
            error!(
                target: "ipc::settings",
                "failed to move application data from {:?} to {:?}: {error}",
                current_settings.app_folder,
                candidate_path
            );
            return Err(IpcError::Internal(
                "Unable to move application data to the selected folder.".into(),
            )
            .into());
        }
    }

    if let Err(error) = db.reopen_with_base_dir(&candidate_path).await {
        error!(
            target: "ipc::settings",
            "failed to reopen database from new folder {:?}: {error}",
            candidate_path
        );

        if let Err(revert_error) =
            move_directory(&candidate_path, &current_settings.app_folder).await
        {
            error!(
                target: "ipc::settings",
                "failed to revert application data after reopening error: {revert_error}"
            );
        }

        return Err(IpcError::Internal(
            "Failed to reopen the database after moving files. Data was restored to the previous location.".into(),
        )
        .into());
    }

    if let Err(error) = db
        .update_project_root_paths(&current_settings.app_folder, &candidate_path)
        .await
    {
        error!(
            target: "ipc::settings",
            "failed to refresh project root paths after moving data: {error}"
        );

        match move_directory(&candidate_path, &current_settings.app_folder).await {
            Ok(_) => {
                if let Err(reopen_error) =
                    db.reopen_with_base_dir(&current_settings.app_folder).await
                {
                    error!(
                        target: "ipc::settings",
                        "failed to reopen database at previous folder after project path update error: {reopen_error}"
                    );
                }
            }
            Err(revert_error) => {
                error!(
                    target: "ipc::settings",
                    "failed to revert application data after project path update error: {revert_error}"
                );
            }
        }

        return Err(IpcError::Internal(
            "Unable to persist the updated settings. Application data was moved back to the previous folder.".into(),
        )
        .into());
    }

    if let Err(error) = settings
        .update_and_save_app_folder(candidate_path.clone())
        .await
    {
        warn!(
            target: "ipc::settings",
            "failed to persist new app folder after moving data: {error}"
        );

        if let Err(revert_error) =
            move_directory(&candidate_path, &current_settings.app_folder).await
        {
            error!(
                target: "ipc::settings",
                "failed to revert application data after settings persistence error: {revert_error}"
            );
        }

        return Err(IpcError::Internal(
            "Unable to persist the updated settings. Application data was moved back to the previous folder.".into(),
        )
        .into());
    }

    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

/// Toggles the automatic conversion behaviour that kicks in whenever a project
/// is opened.
#[tauri::command]
pub async fn update_auto_convert_on_open(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    _db: State<'_, DbManager>,
    enabled: bool,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings.update_and_save_auto_convert_on_open(enabled).await {
        warn!(target: "ipc::settings", "failed to update auto-convert flag: {error}");
        return Err(IpcError::Internal("Unable to update setting. Please retry.".into()).into());
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_theme(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    theme: String,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings.update_and_save_theme(theme).await {
        warn!(target: "ipc::settings", "failed to update theme: {error}");
        return Err(IpcError::Internal("Unable to update theme. Please retry.".into()).into());
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_ui_language(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    language: String,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings.update_and_save_ui_language(language).await {
        warn!(target: "ipc::settings", "failed to update UI language: {error}");
        return Err(IpcError::Internal("Unable to update language. Please retry.".into()).into());
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_default_languages(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    source_language: String,
    target_language: String,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings
        .update_and_save_default_languages(source_language, target_language)
        .await
    {
        warn!(target: "ipc::settings", "failed to update default languages: {error}");
        return Err(
            IpcError::Internal("Unable to update default languages. Please retry.".into()).into(),
        );
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_xliff_version(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    version: String,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings.update_and_save_xliff_version(version).await {
        warn!(target: "ipc::settings", "failed to update XLIFF version: {error}");
        return Err(
            IpcError::Internal("Unable to update XLIFF version. Please retry.".into()).into(),
        );
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_notifications(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    show_notifications: bool,
    enable_sound: bool,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings
        .update_and_save_notifications(show_notifications, enable_sound)
        .await
    {
        warn!(target: "ipc::settings", "failed to update notifications: {error}");
        return Err(
            IpcError::Internal("Unable to update notifications. Please retry.".into()).into(),
        );
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_max_parallel_conversions(
    app: AppHandle,
    settings: State<'_, SettingsManager>,
    max_parallel: u32,
) -> IpcResult<AppSettingsDto> {
    if let Err(error) = settings.update_and_save_max_parallel(max_parallel).await {
        warn!(target: "ipc::settings", "failed to update max parallel conversions: {error}");
        return Err(IpcError::Internal(
            "Unable to update max parallel conversions. Please retry.".into(),
        )
        .into());
    }
    build_app_settings_dto(&app, &settings)
        .await
        .map_err(Into::into)
}

/// Lightweight helper exposed to the renderer to check arbitrary filesystem
/// paths without performing any privileged operation.
#[tauri::command]
pub async fn path_exists(path: String) -> Result<(bool, bool, bool), ()> {
    let p = Path::new(&path);
    let exists = p.exists();
    let is_file = exists && p.is_file();
    let is_dir = exists && p.is_dir();
    Ok((exists, is_file, is_dir))
}

mod db;
mod ipc;
mod jliff;
mod settings;

pub mod ipc_test {
    pub use crate::ipc::commands::{
        build_conversions_plan, read_project_artifact_impl, update_jliff_segment_impl,
        with_project_file_lock,
    };
}

pub use crate::db::constants::MIGRATOR;
pub use crate::db::{
    ArtifactKind, DbError, DbManager, FileTargetBackfillSummary, FilesystemArtifactBackfillSummary,
    NewProject, NewProjectFile, NewTranslationRecord, PersistedTranslationOutput,
    ProjectFileConversionRequest, ProjectFileConversionStatus, ProjectFileImportStatus,
    ProjectFileRole, ProjectFileStorageState, ProjectLifecycleStatus, ProjectStatus, ProjectType,
};
pub use crate::ipc::commands::{
    DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, LOCAL_OWNER_DISPLAY_NAME, LOCAL_OWNER_EMAIL,
    LOCAL_OWNER_USER_ID, build_original_stored_rel_path,
};
pub use crate::ipc::dto::{
    PipelineJobSummary, TranslationHistoryRecord, TranslationRequest, TranslationStage,
};
pub use crate::jliff::{ConversionOptions, GeneratedArtifact, convert_xliff};

use crate::db::JobState;
use ipc::{
    TranslationState, add_files_to_project, clear_translation_history, convert_xliff_to_jliff,
    create_project_with_files, delete_project, ensure_project_conversions_plan, fail_translation,
    get_app_settings, get_project_details, get_translation_job, health_check, list_active_jobs,
    list_projects, list_translation_history, path_exists, read_project_artifact,
    remove_project_file, start_translation, update_app_folder, update_auto_convert_on_open,
    update_conversion_status, update_default_languages, update_jliff_segment,
    update_max_parallel_conversions, update_notifications, update_theme, update_ui_language,
    update_xliff_version,
};
use log::LevelFilter;
use log::kv::VisitSource;
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::fs;
use tauri::async_runtime;
use tauri::{Emitter, Manager};
use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::ipc::events::PIPELINE_JOBS_NEED_ATTENTION;
use crate::settings::{SettingsManager, load_or_init};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            LogBuilder::default()
                .level(LevelFilter::Debug)
                .format(|out, message, record| {
                    let payload = build_json_log_payload(message, record);
                    out.finish(format_args!("{payload}"));
                })
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("weg-translator".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;

            let settings_path = config_dir.join("settings.yaml");
            let default_app_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&default_app_dir)?;

            let initial_settings = load_or_init(&settings_path, default_app_dir.clone())
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            fs::create_dir_all(&initial_settings.app_folder)?;

            let settings_manager =
                SettingsManager::new(settings_path.clone(), initial_settings.clone());

            if !settings_path.exists() {
                async_runtime::block_on(settings_manager.save())
                    .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;
            }

            let db_performance = crate::db::DatabasePerformanceConfig::from_strings(
                &initial_settings.database_journal_mode,
                &initial_settings.database_synchronous,
            );

            let db_manager = async_runtime::block_on(DbManager::new_with_base_dir_and_performance(
                &initial_settings.app_folder,
                db_performance,
            ))
            .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let owner_backfill =
                async_runtime::block_on(db_manager.clone().backfill_project_owner(
                    LOCAL_OWNER_USER_ID,
                    LOCAL_OWNER_EMAIL,
                    LOCAL_OWNER_DISPLAY_NAME,
                ))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            if owner_backfill.ensured_user || owner_backfill.updated_projects > 0 {
                log::info!(
                    target: "app::startup",
                    "backfill_local_owner ensured_user={} updated_projects={}",
                    owner_backfill.ensured_user,
                    owner_backfill.updated_projects
                );
            }

            let language_backfill =
                async_runtime::block_on(db_manager.clone().backfill_project_language_pairs(
                    crate::ipc::commands::DEFAULT_SOURCE_LANGUAGE,
                    crate::ipc::commands::DEFAULT_TARGET_LANGUAGE,
                ))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            if language_backfill.inserted_pairs > 0 {
                log::info!(
                    target: "app::startup",
                    "backfill_language_pairs inserted_pairs={}",
                    language_backfill.inserted_pairs
                );
            }

            let active_jobs = async_runtime::block_on(db_manager.clone().list_jobs(100, 0))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let translation_state = TranslationState::new();
            translation_state.hydrate_from_records(&active_jobs);

            let pipeline_jobs_attention = async_runtime::block_on(
                db_manager
                    .clone()
                    .list_pipeline_jobs_needing_attention(),
            )
            .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            if !pipeline_jobs_attention.is_empty() {
                let pending_count = pipeline_jobs_attention
                    .iter()
                    .filter(|job| job.state == JobState::Pending)
                    .count();
                let failed_count = pipeline_jobs_attention
                    .iter()
                    .filter(|job| job.state == JobState::Failed)
                    .count();

                log::warn!(
                    target: "app::startup",
                    "pipeline jobs require manual attention: pending={} failed={}",
                    pending_count,
                    failed_count
                );

                for job in &pipeline_jobs_attention {
                    log::warn!(
                        target: "app::startup::jobs",
                        "job_id={} project_id={} type={} state={} attempts={} file_target_id={:?} artifact_id={:?} error={:?}",
                        job.job_id,
                        job.project_id,
                        job.job_type.as_str(),
                        job.state.as_str(),
                        job.attempts,
                        job.file_target_id,
                        job.artifact_id,
                        job.error
                    );
                }

                let attention_payload: Vec<PipelineJobSummary> = pipeline_jobs_attention
                    .into_iter()
                    .map(|job| PipelineJobSummary {
                        job_id: job.job_id.to_string(),
                        project_id: job.project_id.to_string(),
                        job_type: job.job_type.as_str().to_string(),
                        state: job.state.as_str().to_string(),
                        attempts: job.attempts,
                        file_target_id: job.file_target_id.map(|id| id.to_string()),
                        artifact_id: job.artifact_id.map(|id| id.to_string()),
                        error: job.error.clone(),
                        created_at: job.created_at,
                        started_at: job.started_at,
                        finished_at: job.finished_at,
                    })
                    .collect();

                let app_handle = app.handle();
                if let Err(error) = app_handle.emit(PIPELINE_JOBS_NEED_ATTENTION, &attention_payload)
                {
                    log::warn!(
                        target: "app::startup",
                        "failed to emit pipeline attention event: {error}"
                    );
                }
            }

            app.manage(settings_manager);
            app.manage(db_manager);
            app.manage(translation_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clear_translation_history,
            create_project_with_files,
            get_project_details,
            add_files_to_project,
            remove_project_file,
            delete_project,
            ensure_project_conversions_plan,
            convert_xliff_to_jliff,
            update_conversion_status,
            read_project_artifact,
            update_auto_convert_on_open,
            health_check,
            get_translation_job,
            get_app_settings,
            list_active_jobs,
            list_projects,
            list_translation_history,
            path_exists,
            update_app_folder,
            start_translation,
            fail_translation,
            update_jliff_segment,
            update_theme,
            update_ui_language,
            update_default_languages,
            update_xliff_version,
            update_notifications,
            update_max_parallel_conversions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_json_log_payload(message: &std::fmt::Arguments<'_>, record: &log::Record<'_>) -> String {
    let mut payload = JsonMap::new();

    let timestamp = OffsetDateTime::now_utc();
    let timestamp_str = timestamp
        .format(&Rfc3339)
        .unwrap_or_else(|_| timestamp.to_string());

    payload.insert("timestamp".into(), JsonValue::String(timestamp_str));
    payload.insert(
        "level".into(),
        JsonValue::String(record.level().to_string()),
    );
    payload.insert(
        "target".into(),
        JsonValue::String(record.target().to_string()),
    );
    payload.insert("message".into(), JsonValue::String(message.to_string()));

    if let Some(module) = record.module_path() {
        payload.insert("modulePath".into(), JsonValue::String(module.to_string()));
    }

    if let Some(file) = record.file() {
        payload.insert("file".into(), JsonValue::String(file.to_string()));
    }

    if let Some(line) = record.line() {
        payload.insert("line".into(), JsonValue::Number(line.into()));
    }

    let mut key_values = JsonMap::new();
    let _ = record.key_values().visit(&mut KvCollector {
        map: &mut key_values,
    });
    if !key_values.is_empty() {
        payload.insert("keyValues".into(), JsonValue::Object(key_values));
    }

    JsonValue::Object(payload).to_string()
}

struct KvCollector<'a> {
    map: &'a mut JsonMap<String, JsonValue>,
}

impl<'kvs> VisitSource<'kvs> for KvCollector<'_> {
    fn visit_pair(
        &mut self,
        key: log::kv::Key<'kvs>,
        value: log::kv::Value<'kvs>,
    ) -> Result<(), log::kv::Error> {
        let text = value
            .to_borrowed_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{value:?}"));
        self.map.insert(key.to_string(), JsonValue::String(text));
        Ok(())
    }
}

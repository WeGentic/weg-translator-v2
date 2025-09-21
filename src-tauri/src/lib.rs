mod db;
mod ipc;
mod settings;

pub use crate::db::{DbError, DbManager, NewTranslationRecord, PersistedTranslationOutput};
pub use crate::ipc::dto::{TranslationHistoryRecord, TranslationRequest, TranslationStage};

use ipc::{
    TranslationState, clear_translation_history, create_project_with_files, fail_translation,
    get_app_settings, get_translation_job, health_check, list_active_jobs, list_projects,
    list_translation_history, path_exists, start_translation, update_app_folder,
};
use log::LevelFilter;
use log::kv::VisitSource;
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::fs;
use tauri::Manager;
use tauri::async_runtime;
use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

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

            let db_manager =
                async_runtime::block_on(DbManager::new_with_base_dir(&initial_settings.app_folder))
                    .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let active_jobs = async_runtime::block_on(db_manager.clone().list_jobs(100, 0))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let translation_state = TranslationState::new();
            translation_state.hydrate_from_records(&active_jobs);

            app.manage(settings_manager);
            app.manage(db_manager);
            app.manage(translation_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clear_translation_history,
            create_project_with_files,
            health_check,
            get_translation_job,
            get_app_settings,
            list_active_jobs,
            list_projects,
            list_translation_history,
            path_exists,
            update_app_folder,
            start_translation,
            fail_translation
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

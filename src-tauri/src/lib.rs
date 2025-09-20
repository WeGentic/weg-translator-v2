mod db;
mod ipc;

pub use crate::db::{DbError, DbManager, NewTranslationRecord, PersistedTranslationOutput};
pub use crate::ipc::dto::{TranslationHistoryRecord, TranslationRequest, TranslationStage};

use crate::db::SQLITE_DB_URL;
use ipc::{
    TranslationState, clear_translation_history, fail_translation, get_translation_job,
    health_check, list_active_jobs, list_translation_history, path_exists, start_translation,
};
use log::LevelFilter;
use log::kv::VisitSource;
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::fs;
use tauri::Manager;
use tauri::async_runtime;
use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sqlite_plugin = SqlBuilder::new()
        .add_migrations(SQLITE_DB_URL, sqlite_migrations())
        .build();

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
        .plugin(sqlite_plugin)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Ok(dir) = app.path().app_config_dir() {
                fs::create_dir_all(&dir)?;
            }

            let handle = app.handle();
            let db_manager = async_runtime::block_on(DbManager::new(&handle))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let active_jobs = async_runtime::block_on(db_manager.clone().list_jobs(100, 0))
                .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)?;

            let translation_state = TranslationState::new();
            translation_state.hydrate_from_records(&active_jobs);

            app.manage(db_manager);
            app.manage(translation_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clear_translation_history,
            health_check,
            get_translation_job,
            list_active_jobs,
            list_translation_history,
            path_exists,
            start_translation,
            fail_translation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn sqlite_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_translation_jobs",
            sql: include_str!("../migrations/001_create_translation_jobs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_translation_outputs",
            sql: include_str!("../migrations/002_create_translation_outputs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "seed_demo_data",
            sql: include_str!("../migrations/003_seed_demo_data.sql"),
            kind: MigrationKind::Up,
        },
    ]
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

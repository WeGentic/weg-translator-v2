use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::task;

#[cfg(target_family = "unix")]
use libc::EXDEV;

#[cfg(target_family = "windows")]
const ERROR_NOT_SAME_DEVICE: i32 = 17;

#[derive(Debug, Clone)]
pub struct AppSettings {
    pub app_folder: PathBuf,
    pub auto_convert_on_open: bool,
    pub theme: String,
    pub ui_language: String,
    pub default_source_language: String,
    pub default_target_language: String,
    pub default_xliff_version: String,
    pub show_notifications: bool,
    pub enable_sound_notifications: bool,
    pub max_parallel_conversions: u32,
}

impl AppSettings {
    pub fn projects_dir(&self) -> PathBuf {
        self.app_folder.join("projects")
    }

    pub fn database_path(&self, file_name: &str) -> PathBuf {
        self.app_folder.join(file_name)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RawSettings {
    #[serde(default)]
    app_folder: Option<PathBuf>,
    #[serde(default = "default_true")]
    auto_convert_on_open: bool,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default = "default_ui_language")]
    ui_language: String,
    #[serde(default = "default_source_language")]
    default_source_language: String,
    #[serde(default = "default_target_language")]
    default_target_language: String,
    #[serde(default = "default_xliff_version")]
    default_xliff_version: String,
    #[serde(default = "default_true")]
    show_notifications: bool,
    #[serde(default = "default_false")]
    enable_sound_notifications: bool,
    #[serde(default = "default_max_parallel")]
    max_parallel_conversions: u32,
}

impl RawSettings {
    fn from_settings(settings: &AppSettings) -> Self {
        Self {
            app_folder: Some(settings.app_folder.clone()),
            auto_convert_on_open: settings.auto_convert_on_open,
            theme: settings.theme.clone(),
            ui_language: settings.ui_language.clone(),
            default_source_language: settings.default_source_language.clone(),
            default_target_language: settings.default_target_language.clone(),
            default_xliff_version: settings.default_xliff_version.clone(),
            show_notifications: settings.show_notifications,
            enable_sound_notifications: settings.enable_sound_notifications,
            max_parallel_conversions: settings.max_parallel_conversions,
        }
    }
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("failed to read settings from disk: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse settings file: {0}")]
    Parse(#[from] serde_yaml::Error),
}

#[derive(Clone)]
pub struct SettingsManager {
    inner: Arc<SettingsInner>,
}

struct SettingsInner {
    file_path: PathBuf,
    settings: RwLock<AppSettings>,
}

impl SettingsManager {
    pub fn new(file_path: PathBuf, initial: AppSettings) -> Self {
        Self {
            inner: Arc::new(SettingsInner {
                file_path,
                settings: RwLock::new(initial),
            }),
        }
    }

    pub fn file_path(&self) -> &Path {
        &self.inner.file_path
    }

    pub async fn current(&self) -> AppSettings {
        self.inner.settings.read().await.clone()
    }

    pub async fn app_folder(&self) -> PathBuf {
        self.inner.settings.read().await.app_folder.clone()
    }

    pub async fn save(&self) -> Result<(), SettingsError> {
        let settings = self.inner.settings.read().await.clone();
        Self::write_to_disk(&self.inner.file_path, &settings)
    }

    pub async fn update_and_save_app_folder(&self, path: PathBuf) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.app_folder.clone();
            guard.app_folder = path;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.app_folder = original;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_auto_convert_on_open(
        &self,
        enabled: bool,
    ) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.auto_convert_on_open;
            guard.auto_convert_on_open = enabled;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.auto_convert_on_open = original;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_theme(&self, theme: String) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.theme.clone();
            guard.theme = theme;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.theme = original;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_ui_language(&self, language: String) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.ui_language.clone();
            guard.ui_language = language;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.ui_language = original;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_default_languages(
        &self,
        source: String,
        target: String,
    ) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original_source = guard.default_source_language.clone();
            let original_target = guard.default_target_language.clone();
            guard.default_source_language = source;
            guard.default_target_language = target;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.default_source_language = original_source;
                guard.default_target_language = original_target;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_xliff_version(&self, version: String) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.default_xliff_version.clone();
            guard.default_xliff_version = version;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.default_xliff_version = original;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_notifications(
        &self,
        show: bool,
        sound: bool,
    ) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original_show = guard.show_notifications;
            let original_sound = guard.enable_sound_notifications;
            guard.show_notifications = show;
            guard.enable_sound_notifications = sound;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.show_notifications = original_show;
                guard.enable_sound_notifications = original_sound;
                return Err(error);
            }
        }
        Ok(())
    }

    pub async fn update_and_save_max_parallel(&self, max: u32) -> Result<(), SettingsError> {
        {
            let mut guard = self.inner.settings.write().await;
            let original = guard.max_parallel_conversions;
            guard.max_parallel_conversions = max;
            if let Err(error) = Self::write_to_disk(&self.inner.file_path, &guard) {
                guard.max_parallel_conversions = original;
                return Err(error);
            }
        }
        Ok(())
    }
}

pub fn load_or_init(
    file_path: &Path,
    default_app_folder: PathBuf,
) -> Result<AppSettings, SettingsError> {
    if file_path.exists() {
        let text = fs::read_to_string(file_path)?;
        let raw: RawSettings = serde_yaml::from_str(&text)?;
        Ok(AppSettings {
            app_folder: raw.app_folder.unwrap_or(default_app_folder),
            auto_convert_on_open: raw.auto_convert_on_open,
            theme: raw.theme,
            ui_language: raw.ui_language,
            default_source_language: raw.default_source_language,
            default_target_language: raw.default_target_language,
            default_xliff_version: raw.default_xliff_version,
            show_notifications: raw.show_notifications,
            enable_sound_notifications: raw.enable_sound_notifications,
            max_parallel_conversions: raw.max_parallel_conversions,
        })
    } else {
        Ok(AppSettings {
            app_folder: default_app_folder,
            auto_convert_on_open: true,
            theme: default_theme(),
            ui_language: default_ui_language(),
            default_source_language: default_source_language(),
            default_target_language: default_target_language(),
            default_xliff_version: default_xliff_version(),
            show_notifications: true,
            enable_sound_notifications: false,
            max_parallel_conversions: default_max_parallel(),
        })
    }
}

impl SettingsManager {
    fn write_to_disk(path: &Path, settings: &AppSettings) -> Result<(), SettingsError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let raw = RawSettings::from_settings(settings);
        let yaml = serde_yaml::to_string(&raw)?;
        fs::write(path, yaml)?;
        Ok(())
    }
}

fn default_true() -> bool {
    true
}

fn default_false() -> bool {
    false
}

fn default_theme() -> String {
    "auto".to_string()
}

fn default_ui_language() -> String {
    "en".to_string()
}

fn default_source_language() -> String {
    "en-US".to_string()
}

fn default_target_language() -> String {
    "es-ES".to_string()
}

fn default_xliff_version() -> String {
    "2.1".to_string()
}

fn default_max_parallel() -> u32 {
    4
}

pub async fn move_directory(old_path: &Path, new_path: &Path) -> io::Result<()> {
    let source = old_path.to_path_buf();
    let target = new_path.to_path_buf();
    task::spawn_blocking(move || move_directory_blocking(&source, &target))
        .await
        .map_err(|err| io::Error::new(ErrorKind::Other, err.to_string()))?
}

fn move_directory_blocking(old_path: &Path, new_path: &Path) -> io::Result<()> {
    match fs::rename(old_path, new_path) {
        Ok(_) => Ok(()),
        Err(error) if is_cross_device_link(&error) || error.kind() == ErrorKind::AlreadyExists => {
            copy_dir_recursive(old_path, new_path)?;
            fs::remove_dir_all(old_path)?;
            Ok(())
        }
        Err(error) => Err(error),
    }
}

fn is_cross_device_link(error: &io::Error) -> bool {
    #[cfg(target_family = "unix")]
    {
        return error.raw_os_error() == Some(EXDEV);
    }

    #[cfg(target_family = "windows")]
    {
        return error.raw_os_error() == Some(ERROR_NOT_SAME_DEVICE);
    }

    #[cfg(not(any(target_family = "unix", target_family = "windows")))]
    {
        return false;
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> io::Result<()> {
    if !target.exists() {
        fs::create_dir_all(target)?;
    }

    for entry_result in fs::read_dir(source)? {
        let entry = entry_result?;
        let file_type = entry.file_type()?;
        let destination = target.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &destination)?;
        } else {
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &destination)?;
        }
    }

    Ok(())
}

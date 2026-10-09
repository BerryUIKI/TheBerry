use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use super::paths::{ensure_directory_exists, get_bootstrap_config_path, get_bootstrap_dir};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BootstrapConfig {
    pub custom_data_dir: Option<String>,
    pub initialized: bool,
}

fn default_app_language() -> String {
    "en".to_string()
}

fn default_global_shortcuts_enabled() -> bool {
    true
}

fn default_hud_shortcut() -> String {
    "Alt+Space".to_string()
}

fn default_clipboard_monitor_enabled() -> bool {
    false
}

fn default_quicklook_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub version: String,
    pub theme: String, // "dark" | "light" | "system"
    #[serde(default = "default_app_language")]
    pub language: String, // "en" | "zh"
    pub close_to_tray: bool,
    pub autostart: bool,
    #[serde(default = "default_global_shortcuts_enabled")]
    pub global_shortcuts_enabled: bool,
    #[serde(default = "default_hud_shortcut")]
    pub hud_shortcut: String,
    pub clipboard_history_limit: usize,
    #[serde(default = "default_clipboard_monitor_enabled")]
    pub clipboard_monitor_enabled: bool,
    #[serde(default = "default_quicklook_enabled")]
    pub quicklook_enabled: bool,
    pub custom_data_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: "0.1.13".to_string(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            close_to_tray: true,
            autostart: false,
            global_shortcuts_enabled: true,
            hud_shortcut: "Alt+Space".to_string(),
            clipboard_history_limit: 200,
            clipboard_monitor_enabled: false,
            quicklook_enabled: true,
            custom_data_dir: "".to_string(),
        }
    }
}

pub struct ConfigManager {
    bootstrap: RwLock<BootstrapConfig>,
    app_config: RwLock<AppConfig>,
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigManager {
    pub fn new() -> Self {
        let manager = Self::with_bootstrap(BootstrapConfig::default());
        manager.load_bootstrap();
        manager
    }

    /// Construct an in-memory manager without reading or writing the user profile.
    pub fn with_bootstrap(bootstrap: BootstrapConfig) -> Self {
        Self {
            bootstrap: RwLock::new(bootstrap),
            app_config: RwLock::new(AppConfig::default()),
        }
    }

    pub fn is_initialized(&self) -> bool {
        self.bootstrap.read().unwrap().initialized
    }

    pub fn get_data_dir(&self) -> Option<PathBuf> {
        self.bootstrap
            .read()
            .unwrap()
            .custom_data_dir
            .as_ref()
            .map(PathBuf::from)
    }

    pub fn load_bootstrap(&self) {
        let path = get_bootstrap_config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = toml::from_str::<BootstrapConfig>(&content) {
                    *self.bootstrap.write().unwrap() = config;
                }
            }
        }
    }

    pub fn save_bootstrap(&self, data_dir: &str) -> std::io::Result<()> {
        let dir = get_bootstrap_dir();
        ensure_directory_exists(&dir)?;
        let path = get_bootstrap_config_path();
        let config = BootstrapConfig {
            custom_data_dir: Some(data_dir.to_string()),
            initialized: true,
        };
        let serialized = toml::to_string_pretty(&config)
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        fs::write(path, serialized)?;
        *self.bootstrap.write().unwrap() = config;
        Ok(())
    }

    pub fn load_app_config(&self, data_dir: &Path) -> std::io::Result<AppConfig> {
        let config_file = data_dir.join("config.toml");
        if config_file.exists() {
            let content = fs::read_to_string(&config_file)?;
            let config: AppConfig = match toml::from_str(&content) {
                Ok(cfg) => cfg,
                Err(e) => {
                    tracing::warn!("Failed to parse config.toml: {}. Falling back to default configuration.", e);
                    AppConfig {
                        custom_data_dir: data_dir.to_string_lossy().to_string(),
                        ..Default::default()
                    }
                }
            };
            *self.app_config.write().unwrap() = config.clone();
            Ok(config)
        } else {
            let default_config = AppConfig {
                custom_data_dir: data_dir.to_string_lossy().to_string(),
                ..Default::default()
            };
            self.save_app_config(data_dir, &default_config)?;
            *self.app_config.write().unwrap() = default_config.clone();
            Ok(default_config)
        }
    }

    pub fn save_app_config(&self, data_dir: &Path, config: &AppConfig) -> std::io::Result<()> {
        let mut current = self.app_config.write().unwrap();
        ensure_directory_exists(data_dir)?;
        let config_file = data_dir.join("config.toml");
        let serialized = toml::to_string_pretty(config)
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        fs::write(config_file, serialized)?;
        *current = config.clone();
        Ok(())
    }

    pub fn get_app_config(&self) -> AppConfig {
        self.app_config.read().unwrap().clone()
    }

    /// Merge a field-level update under the same lock used to persist it.
    pub fn patch_app_config(
        &self,
        data_dir: &Path,
        patch: serde_json::Map<String, serde_json::Value>,
    ) -> std::io::Result<AppConfig> {
        let mut current = self.app_config.write().unwrap();
        let mut value = serde_json::to_value(&*current).map_err(std::io::Error::other)?;
        let fields = value.as_object_mut().unwrap();
        for (key, value) in patch {
            if !fields.contains_key(&key) {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, format!("Unknown setting: {key}")));
            }
            fields.insert(key, value);
        }
        let updated: AppConfig = serde_json::from_value(value).map_err(std::io::Error::other)?;
        ensure_directory_exists(data_dir)?;
        let serialized = toml::to_string_pretty(&updated).map_err(std::io::Error::other)?;
        fs::write(data_dir.join("config.toml"), serialized)?;
        *current = updated.clone();
        Ok(updated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manager() -> ConfigManager {
        ConfigManager {
            bootstrap: RwLock::new(BootstrapConfig::default()),
            app_config: RwLock::new(AppConfig::default()),
        }
    }

    #[test]
    fn unrelated_saves_preserve_paused_monitoring() {
        let dir = tempfile::tempdir().unwrap();
        let manager = manager();
        for patch in [
            serde_json::json!({"clipboard_monitor_enabled": true}),
            serde_json::json!({"clipboard_monitor_enabled": false}),
            serde_json::json!({"theme": "light"}),
        ] {
            manager.patch_app_config(dir.path(), patch.as_object().unwrap().clone()).unwrap();
        }
        let current = manager.get_app_config();
        assert!(!current.clipboard_monitor_enabled);
        assert_eq!(current.theme, "light");
        let persisted: AppConfig = toml::from_str(&fs::read_to_string(dir.path().join("config.toml")).unwrap()).unwrap();
        assert!(!persisted.clipboard_monitor_enabled);
    }

    #[test]
    fn concurrent_field_updates_do_not_overwrite_each_other() {
        let dir = tempfile::tempdir().unwrap();
        let manager = manager();
        std::thread::scope(|scope| {
            for patch in [serde_json::json!({"theme": "light"}), serde_json::json!({"language": "zh"})] {
                let manager = &manager;
                let path = dir.path();
                scope.spawn(move || manager.patch_app_config(path, patch.as_object().unwrap().clone()).unwrap());
            }
        });
        let current = manager.get_app_config();
        assert_eq!(current.theme, "light");
        assert_eq!(current.language, "zh");
    }

    #[test]
    fn rejects_invalid_patch_without_changing_configuration() {
        let dir = tempfile::tempdir().unwrap();
        let manager = manager();
        for patch in [serde_json::json!({"clipboard_monitor_enabled": "true"}), serde_json::json!({"unknown": true})] {
            assert!(manager.patch_app_config(dir.path(), patch.as_object().unwrap().clone()).is_err());
        }
        assert!(!manager.get_app_config().clipboard_monitor_enabled);
    }
}

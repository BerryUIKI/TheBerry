use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use super::paths::{ensure_directory_exists, get_bootstrap_config_path, get_bootstrap_dir};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapConfig {
    pub custom_data_dir: Option<String>,
    pub initialized: bool,
}

impl Default for BootstrapConfig {
    fn default() -> Self {
        Self {
            custom_data_dir: None,
            initialized: false,
        }
    }
}

fn default_app_language() -> String {
    "en".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub theme: String, // "dark" | "light" | "system"
    #[serde(default = "default_app_language")]
    pub language: String, // "en" | "zh"
    pub close_to_tray: bool,
    pub autostart: bool,
    pub clipboard_history_limit: usize,
    pub custom_data_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: "0.1.3".to_string(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            close_to_tray: true,
            autostart: false,
            clipboard_history_limit: 200,
            custom_data_dir: String::new(),
        }
    }
}

pub struct ConfigManager {
    bootstrap: RwLock<BootstrapConfig>,
    app_config: RwLock<AppConfig>,
}

impl ConfigManager {
    pub fn new() -> Self {
        let manager = Self {
            bootstrap: RwLock::new(BootstrapConfig::default()),
            app_config: RwLock::new(AppConfig::default()),
        };
        manager.load_bootstrap();
        manager
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
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        fs::write(path, serialized)?;
        *self.bootstrap.write().unwrap() = config;
        Ok(())
    }

    pub fn load_app_config(&self, data_dir: &PathBuf) -> std::io::Result<AppConfig> {
        let config_file = data_dir.join("config.toml");
        if config_file.exists() {
            let content = fs::read_to_string(&config_file)?;
            let config: AppConfig = toml::from_str(&content)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            *self.app_config.write().unwrap() = config.clone();
            Ok(config)
        } else {
            let mut default_config = AppConfig::default();
            default_config.custom_data_dir = data_dir.to_string_lossy().to_string();
            self.save_app_config(data_dir, &default_config)?;
            *self.app_config.write().unwrap() = default_config.clone();
            Ok(default_config)
        }
    }

    pub fn save_app_config(&self, data_dir: &PathBuf, config: &AppConfig) -> std::io::Result<()> {
        ensure_directory_exists(data_dir)?;
        let config_file = data_dir.join("config.toml");
        let serialized = toml::to_string_pretty(config)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        fs::write(config_file, serialized)?;
        *self.app_config.write().unwrap() = config.clone();
        Ok(())
    }

    pub fn get_app_config(&self) -> AppConfig {
        self.app_config.read().unwrap().clone()
    }
}

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use crate::core::config::AppConfig;
use crate::core::paths::get_suggested_data_dir;
use crate::core::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppStatusResponse {
    pub initialized: bool,
    pub data_dir: Option<String>,
    pub suggested_data_dir: String,
}

#[tauri::command]
pub fn get_app_status(state: State<AppState>) -> AppStatusResponse {
    let initialized = state.config_manager.is_initialized();
    let data_dir = state
        .config_manager
        .get_data_dir()
        .map(|p| p.to_string_lossy().to_string());
    let suggested_data_dir = get_suggested_data_dir().to_string_lossy().to_string();

    AppStatusResponse {
        initialized,
        data_dir,
        suggested_data_dir,
    }
}

#[tauri::command]
pub fn initialize_data_dir(custom_data_dir: String, state: State<AppState>) -> Result<AppConfig, String> {
    let path = PathBuf::from(&custom_data_dir);
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create data directory at {}: {}", custom_data_dir, e))?;
    }

    // Save bootstrap pointer
    state
        .config_manager
        .save_bootstrap(&custom_data_dir)
        .map_err(|e| format!("Failed to save bootstrap config: {}", e))?;

    // Initialize or load config.toml inside the custom data dir
    let config = state
        .config_manager
        .load_app_config(&path)
        .map_err(|e| format!("Failed to initialize app config: {}", e))?;

    // Initialize redb database
    state
        .db_manager
        .initialize(&path)
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    Ok(config)
}

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Result<AppConfig, String> {
    Ok(state.config_manager.get_app_config())
}

#[tauri::command]
pub fn update_config(config: AppConfig, state: State<AppState>) -> Result<AppConfig, String> {
    let data_dir = state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "Data directory not configured".to_string())?;

    state
        .config_manager
        .save_app_config(&data_dir, &config)
        .map_err(|e| format!("Failed to save config: {}", e))?;

    Ok(config)
}

use tauri::{AppHandle, State};
use crate::core::AppState;
use super::service::{UpdateInfo, UpdaterService, CURRENT_APP_VERSION};

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    UpdaterService::check_latest_release(CURRENT_APP_VERSION).await
}

#[tauri::command]
pub async fn download_update(
    download_url: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let root_dir = state.config_manager.get_data_dir();
    UpdaterService::download_update(
        &download_url,
        root_dir.as_deref(),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn install_and_restart(
    file_path: Option<String>,
    silent: Option<bool>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let root_dir = state.config_manager.get_data_dir();
    UpdaterService::install_and_restart(
        file_path.as_deref(),
        silent.unwrap_or(true),
        root_dir.as_deref(),
        app_handle,
    )
}

#[tauri::command]
pub async fn download_and_install_update(
    download_url: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let root_dir = state.config_manager.get_data_dir();
    UpdaterService::download_and_install_update(
        &download_url,
        root_dir.as_deref(),
        app_handle,
    )
    .await
}

#[tauri::command]
pub fn get_app_version() -> String {
    CURRENT_APP_VERSION.to_string()
}

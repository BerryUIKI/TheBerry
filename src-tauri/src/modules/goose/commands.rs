use tauri::{AppHandle, State};

use crate::core::AppState;
use super::types::{GooseStatus, SendGooseMessagePayload};

#[tauri::command]
pub async fn get_goose_status(app_state: State<'_, AppState>) -> Result<GooseStatus, String> {
    Ok(app_state.goose_service.get_status())
}

#[tauri::command]
pub async fn start_goose_daemon(
    custom_port: Option<u16>,
    app_state: State<'_, AppState>,
) -> Result<GooseStatus, String> {
    app_state.goose_service.start_daemon(custom_port).await
}

#[tauri::command]
pub async fn stop_goose_daemon(app_state: State<'_, AppState>) -> Result<(), String> {
    app_state.goose_service.stop_daemon().await
}

#[tauri::command]
pub async fn send_goose_message(
    app: AppHandle,
    payload: SendGooseMessagePayload,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    app_state.goose_service.send_message(app, payload).await
}

#[tauri::command]
pub async fn set_goose_custom_binary_path(
    path: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<GooseStatus, String> {
    app_state.goose_service.get_process_manager().set_custom_binary_path(path);
    Ok(app_state.goose_service.get_status())
}

#[tauri::command]
pub async fn get_ai_config(app_state: State<'_, AppState>) -> Result<super::types::AIConfig, String> {
    Ok(app_state.goose_service.get_ai_config())
}

#[tauri::command]
pub async fn save_ai_config(
    config: super::types::AIConfig,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    app_state.goose_service.save_ai_config(config)
}


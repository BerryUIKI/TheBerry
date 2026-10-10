use tauri::{AppHandle, State};

use super::types::{GooseStatus, SendGooseMessagePayload};
use crate::core::AppState;

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
pub async fn abort_goose_message(
    session_id: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(app_state.goose_service.abort_message(&session_id))
}

#[tauri::command]
pub async fn set_goose_custom_binary_path(
    path: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<GooseStatus, String> {
    app_state
        .goose_service
        .get_process_manager()
        .set_custom_binary_path(path);
    Ok(app_state.goose_service.get_status())
}

#[tauri::command]
pub async fn get_ai_config(
    app_state: State<'_, AppState>,
) -> Result<super::types::AIConfig, String> {
    Ok(app_state.goose_service.get_ai_config())
}

#[tauri::command]
pub async fn save_ai_config(
    config: super::types::AIConfig,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    app_state.goose_service.save_ai_config(config)
}

#[tauri::command]
pub async fn fetch_provider_models(
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
    request_format: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    app_state
        .goose_service
        .fetch_provider_models(provider, base_url, api_key, request_format)
        .await
}

#[tauri::command]
pub async fn get_ollama_status(
    app_state: State<'_, AppState>,
) -> Result<super::ollama::OllamaStatus, String> {
    Ok(app_state.goose_service.get_ollama_status().await)
}

#[tauri::command]
pub async fn start_ollama_daemon(
    app_state: State<'_, AppState>,
) -> Result<super::ollama::OllamaStatus, String> {
    app_state.goose_service.ensure_ollama_running().await
}

#[tauri::command]
pub async fn stop_ollama_daemon(app_state: State<'_, AppState>) -> Result<(), String> {
    app_state.goose_service.stop_ollama_daemon().await
}

#[tauri::command]
pub fn list_local_models(
    app_state: State<'_, AppState>,
) -> Result<Vec<super::local::LocalModel>, String> {
    app_state.goose_service.list_local_models()
}

#[tauri::command]
pub async fn get_local_runtime_status(
    app_state: State<'_, AppState>,
) -> Result<super::local::LocalRuntimeStatus, String> {
    Ok(app_state.goose_service.get_local_runtime_status().await)
}

#[tauri::command]
pub async fn start_local_runtime(
    app: AppHandle,
    model_id: String,
    app_state: State<'_, AppState>,
) -> Result<super::local::LocalRuntimeStatus, String> {
    app_state
        .goose_service
        .start_local_runtime(&app, &model_id)
        .await
}

#[tauri::command]
pub async fn stop_local_runtime(app_state: State<'_, AppState>) -> Result<(), String> {
    app_state.goose_service.stop_local_runtime().await
}

#[tauri::command]
pub async fn download_local_model(
    app: AppHandle,
    model_id: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    app_state
        .goose_service
        .download_local_model(app, &model_id)
        .await
}

#[tauri::command]
pub fn cancel_local_model_download(
    model_id: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(app_state
        .goose_service
        .cancel_local_model_download(&model_id))
}

#[tauri::command]
pub fn import_local_model(
    path: String,
    app_state: State<'_, AppState>,
) -> Result<super::local::LocalModel, String> {
    app_state.goose_service.import_local_model(&path)
}

#[tauri::command]
pub async fn remove_local_model(
    model_id: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    app_state.goose_service.remove_local_model(&model_id).await
}

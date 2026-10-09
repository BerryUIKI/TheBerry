use tauri::{AppHandle, Emitter, State};
use crate::core::AppState;
use super::service::{ClipboardItem, ClipboardService};

#[tauri::command]
pub fn get_clipboard_history(state: State<AppState>) -> Result<Vec<ClipboardItem>, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.get_history()
}

#[tauri::command]
pub fn search_clipboard_history(
    query: String,
    content_type: Option<String>,
    is_pinned: Option<bool>,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<ClipboardItem>, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.search_history(&query, content_type.as_deref(), is_pinned, limit)
}

#[tauri::command]
pub fn add_clipboard_item(
    content: String,
    content_type: Option<String>,
    state: State<AppState>,
) -> Result<ClipboardItem, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.add_item(content, content_type.unwrap_or_else(|| "text".to_string()))
}

#[tauri::command]
pub fn toggle_clipboard_pin(id: String, state: State<AppState>) -> Result<ClipboardItem, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.toggle_pin(&id)
}

#[tauri::command]
pub fn delete_clipboard_item(id: String, state: State<AppState>) -> Result<(), String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.delete_item(&id)
}

#[tauri::command]
pub fn clear_clipboard_history(state: State<AppState>) -> Result<usize, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.clear_unpinned()
}

#[tauri::command]
pub fn copy_to_system_clipboard(content: String) -> Result<(), String> {
    ClipboardService::copy_to_clipboard(&content)
}

#[tauri::command]
pub fn copy_image_to_system_clipboard(image_path: String) -> Result<(), String> {
    ClipboardService::copy_image_to_clipboard(&image_path)
}

#[tauri::command]
pub fn get_clipboard_monitor_enabled(state: State<AppState>) -> Result<bool, String> {
    Ok(state.clipboard_monitor_enabled.load(std::sync::atomic::Ordering::Relaxed))
}

#[tauri::command]
pub fn set_clipboard_monitor_enabled(enabled: bool, app: AppHandle, state: State<AppState>) -> Result<bool, String> {
    if let Some(data_dir) = state.config_manager.get_data_dir() {
        let patch = serde_json::json!({"clipboard_monitor_enabled": enabled});
        let current = state.config_manager.patch_app_config(&data_dir, patch.as_object().unwrap().clone())
            .map_err(|e| format!("Failed to save clipboard monitoring setting: {e}"))?;
        let _ = app.emit("config-changed", &current);
    }
    state.clipboard_monitor_enabled.store(enabled, std::sync::atomic::Ordering::Relaxed);
    Ok(enabled)
}


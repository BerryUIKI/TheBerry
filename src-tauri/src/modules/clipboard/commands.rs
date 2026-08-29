use tauri::State;
use crate::core::AppState;
use super::service::{ClipboardItem, ClipboardService};

#[tauri::command]
pub fn get_clipboard_history(state: State<AppState>) -> Result<Vec<ClipboardItem>, String> {
    let service = ClipboardService::new(state.db_manager.clone());
    service.get_history()
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

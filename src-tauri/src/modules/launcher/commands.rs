use tauri::State;
use crate::core::AppState;
use super::service::{LauncherItem, LauncherPayload, LauncherService};

#[tauri::command]
pub fn get_launcher_items(state: State<AppState>) -> Result<Vec<LauncherItem>, String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.get_items()
}

#[tauri::command]
pub fn save_launcher_item(payload: LauncherPayload, state: State<AppState>) -> Result<LauncherItem, String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.save_item(payload)
}

#[tauri::command]
pub fn delete_launcher_item(id: String, state: State<AppState>) -> Result<(), String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.delete_item(&id)
}

#[tauri::command]
pub fn launch_item(id: String, state: State<AppState>) -> Result<String, String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.launch(&id)
}

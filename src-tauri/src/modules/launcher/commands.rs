use tauri::State;
use crate::core::AppState;
use super::scanner::{AppScanner, DiscoveredApp};
use super::service::{LauncherItem, LauncherPayload, LauncherService};

#[tauri::command]
pub fn get_launcher_items(state: State<AppState>) -> Result<Vec<LauncherItem>, String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.get_items()
}

#[tauri::command]
pub fn save_launcher_item(
    payload: LauncherPayload,
    state: State<AppState>,
) -> Result<LauncherItem, String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.save_item(payload)
}

#[tauri::command]
pub fn delete_launcher_item(id: String, state: State<AppState>) -> Result<(), String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.delete_item(&id)
}

#[tauri::command]
pub fn launch_item(id: String, state: State<AppState>) -> Result<(), String> {
    let service = LauncherService::new(state.db_manager.clone());
    service.launch(&id).map(|_| ())
}

#[tauri::command]
pub fn discover_system_apps() -> Vec<DiscoveredApp> {
    AppScanner::scan_start_menu_apps()
}

#[tauri::command]
pub fn batch_import_launcher_items(
    items: Vec<DiscoveredApp>,
    state: State<AppState>,
) -> Result<usize, String> {
    let service = LauncherService::new(state.db_manager.clone());
    let mut imported = 0;
    for app in items {
        let payload = LauncherPayload {
            id: None,
            name: app.name,
            description: Some("Auto-discovered installed application".to_string()),
            exec_path: app.exec_path,
            arguments: None,
            working_dir: None,
            category: Some(app.category),
            is_favorite: Some(false),
            is_batch: Some(false),
            batch_commands: None,
        };
        if service.save_item(payload).is_ok() {
            imported += 1;
        }
    }
    Ok(imported)
}

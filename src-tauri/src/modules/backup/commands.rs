use tauri::State;
use crate::core::AppState;
use super::service::{BackupService, BackupSummary};

#[tauri::command]
pub fn export_full_backup(state: State<AppState>) -> Result<String, String> {
    let service = BackupService::new(state.db_manager.clone(), state.config_manager.clone());
    service.export_backup_json()
}

#[tauri::command]
pub fn import_full_backup(json_content: String, state: State<AppState>) -> Result<BackupSummary, String> {
    let service = BackupService::new(state.db_manager.clone(), state.config_manager.clone());
    service.import_backup_json(&json_content)
}

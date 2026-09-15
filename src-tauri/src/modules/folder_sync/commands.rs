use super::model::{
    CompareVariant, ComparisonItem, ComparisonManifest, DeletionVariant, PathFilter, SyncProfile,
    SyncResult, SyncVariant,
};
use crate::core::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn folder_sync_compare(
    state: State<'_, AppState>,
    left_path: String,
    right_path: String,
    compare_variant: CompareVariant,
    sync_variant: SyncVariant,
    filter: Option<PathFilter>,
) -> Result<ComparisonManifest, String> {
    let service = state.folder_sync_service.clone();
    tokio::task::spawn_blocking(move || {
        service.compare_folders(&left_path, &right_path, compare_variant, sync_variant, filter)
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
pub async fn folder_sync_execute(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    left_path: String,
    right_path: String,
    items: Vec<ComparisonItem>,
    deletion_variant: DeletionVariant,
    versioning_dir: Option<String>,
) -> Result<SyncResult, String> {
    let service = state.folder_sync_service.clone();
    tokio::task::spawn_blocking(move || {
        service.execute_sync(
            app_handle,
            job_id,
            left_path,
            right_path,
            items,
            deletion_variant,
            versioning_dir,
        )
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
pub fn folder_sync_cancel(state: State<'_, AppState>, job_id: String) -> bool {
    state.folder_sync_service.cancel_sync(&job_id)
}

#[tauri::command]
pub fn folder_sync_get_profiles(state: State<'_, AppState>) -> Result<Vec<SyncProfile>, String> {
    state.folder_sync_service.get_profiles()
}

#[tauri::command]
pub fn folder_sync_save_profile(
    state: State<'_, AppState>,
    profile: SyncProfile,
) -> Result<SyncProfile, String> {
    state.folder_sync_service.save_profile(profile)
}

#[tauri::command]
pub fn folder_sync_delete_profile(state: State<'_, AppState>, profile_id: String) -> Result<bool, String> {
    state.folder_sync_service.delete_profile(&profile_id)
}

#[tauri::command]
pub fn folder_sync_toggle_realtime(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    enabled: bool,
) -> Result<bool, String> {
    state
        .folder_sync_service
        .toggle_realtime(app_handle, &profile_id, enabled)
}

#[tauri::command]
pub fn folder_sync_get_history(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<SyncResult>, String> {
    state.folder_sync_service.get_history(limit.unwrap_or(20))
}

use super::types::{QuickLookPreviewPayload, QuickLookStatus};

#[cfg(target_os = "windows")]
use super::windows::QuickLookService;

#[cfg(not(target_os = "windows"))]
use super::stub::QuickLookService;

#[tauri::command]
pub async fn get_quicklook_status() -> Result<QuickLookStatus, String> {
    Ok(QuickLookService::get_status())
}

#[tauri::command]
pub async fn quicklook_preview(payload: QuickLookPreviewPayload) -> Result<bool, String> {
    QuickLookService::preview(payload)
}

#[tauri::command]
pub async fn quicklook_close() -> Result<(), String> {
    QuickLookService::close()
}

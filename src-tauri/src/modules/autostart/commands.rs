use super::service::AutostartService;
use tauri::command;

#[command]
pub async fn is_autostart_enabled() -> Result<bool, String> {
    AutostartService::is_enabled()
}

#[command]
pub async fn set_autostart(enabled: bool) -> Result<bool, String> {
    if enabled {
        AutostartService::enable(None)?;
    } else {
        AutostartService::disable()?;
    }
    AutostartService::is_enabled()
}

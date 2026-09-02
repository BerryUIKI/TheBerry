use tauri::{AppHandle, State};
use crate::core::AppState;
use super::service::ShortcutService;

#[tauri::command]
pub async fn set_global_shortcuts_enabled(
    enabled: bool,
    app: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = app_state.config_manager.get_app_config();
    config.global_shortcuts_enabled = enabled;

    let root_dir = app_state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "Data directory not initialized".to_string())?;
    app_state
        .config_manager
        .save_app_config(&root_dir, &config)
        .map_err(|e| e.to_string())?;

    ShortcutService::set_enabled(&app, enabled, &config.hud_shortcut)?;
    Ok(())
}

#[tauri::command]
pub async fn set_hud_shortcut(
    shortcut: String,
    app: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = app_state.config_manager.get_app_config();
    let old_shortcut = config.hud_shortcut.clone();
    config.hud_shortcut = shortcut.clone();

    let root_dir = app_state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "Data directory not initialized".to_string())?;
    app_state
        .config_manager
        .save_app_config(&root_dir, &config)
        .map_err(|e| e.to_string())?;

    if config.global_shortcuts_enabled {
        let _ = ShortcutService::unregister_all(&app);
        if let Err(e) = ShortcutService::register_hud_shortcut(&app, &shortcut) {
            config.hud_shortcut = old_shortcut.clone();
            let _ = app_state.config_manager.save_app_config(&root_dir, &config);
            let _ = ShortcutService::register_hud_shortcut(&app, &old_shortcut);
            return Err(format!("Failed to register shortcut '{}': {}", shortcut, e));
        }
    }
    Ok(())
}

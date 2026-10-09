use tauri::{AppHandle, Emitter, State};
use crate::core::AppState;
use super::service::ShortcutService;

#[tauri::command]
pub async fn set_global_shortcuts_enabled(
    enabled: bool,
    app: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let root_dir = app_state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "Data directory not initialized".to_string())?;
    let patch = serde_json::json!({"global_shortcuts_enabled": enabled});
    let config = app_state
        .config_manager
        .patch_app_config(&root_dir, patch.as_object().unwrap().clone())
        .map_err(|e| e.to_string())?;

    ShortcutService::set_enabled(&app, enabled, &config.hud_shortcut)?;
    let _ = app.emit("config-changed", &config);
    Ok(())
}

#[tauri::command]
pub async fn set_hud_shortcut(
    shortcut: String,
    app: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let old_shortcut = app_state.config_manager.get_app_config().hud_shortcut;

    let root_dir = app_state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "Data directory not initialized".to_string())?;
    let patch = serde_json::json!({"hud_shortcut": shortcut});
    let config = app_state
        .config_manager
        .patch_app_config(&root_dir, patch.as_object().unwrap().clone())
        .map_err(|e| e.to_string())?;

    if config.global_shortcuts_enabled {
        let _ = ShortcutService::unregister_all(&app);
        if let Err(e) = ShortcutService::register_hud_shortcut(&app, &shortcut) {
            let patch = serde_json::json!({"hud_shortcut": old_shortcut});
            if let Ok(restored) = app_state.config_manager.patch_app_config(&root_dir, patch.as_object().unwrap().clone()) {
                let _ = app.emit("config-changed", &restored);
            }
            let _ = ShortcutService::register_hud_shortcut(&app, &old_shortcut);
            return Err(format!("Failed to register shortcut '{}': {}", shortcut, e));
        }
    }
    let _ = app.emit("config-changed", &config);
    Ok(())
}

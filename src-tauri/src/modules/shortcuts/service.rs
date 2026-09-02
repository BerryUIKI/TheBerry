use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use std::str::FromStr;

pub struct ShortcutService;

impl ShortcutService {
    pub fn register_hud_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
        let shortcut = Shortcut::from_str(shortcut_str)
            .map_err(|e| format!("Invalid shortcut format '{}': {}", shortcut_str, e))?;

        if !app.global_shortcut().is_registered(shortcut) {
            app.global_shortcut()
                .register(shortcut)
                .map_err(|e| format!("Failed to register global shortcut: {}", e))?;
        }
        Ok(())
    }

    pub fn unregister_all(app: &AppHandle) -> Result<(), String> {
        app.global_shortcut()
            .unregister_all()
            .map_err(|e| format!("Failed to unregister global shortcuts: {}", e))
    }

    pub fn set_enabled(app: &AppHandle, enabled: bool, shortcut_str: &str) -> Result<(), String> {
        if enabled {
            Self::register_hud_shortcut(app, shortcut_str)?;
        } else {
            Self::unregister_all(app)?;
        }
        Ok(())
    }

    pub fn on_hud_shortcut_pressed(app: &AppHandle) {
        if let Some(window) = app.get_webview_window("hud") {
            let is_visible = window.is_visible().unwrap_or(false);
            if is_visible {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.center();
                let _ = window.set_focus();
            }
        }
    }
}

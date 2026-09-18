use tauri::{AppHandle, Manager, State, Window};
use crate::core::AppState;

#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_maximize_window(window: Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn close_window(window: Window, state: State<'_, AppState>) -> Result<(), String> {
    if window.label() == "settings" {
        window.close().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let config = state.config_manager.get_app_config();
    if config.close_to_tray {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("TheBerry Settings")
    .inner_size(920.0, 660.0)
    .min_inner_size(780.0, 520.0)
    .decorations(false)
    .transparent(false)
    .resizable(true)
    .center();

    #[cfg(target_os = "windows")]
    let builder = builder.shadow(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_hud_window(app: AppHandle, show: Option<bool>) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("hud") {
        let is_visible = window.is_visible().unwrap_or(false);
        let should_show = show.unwrap_or(!is_visible);
        if should_show {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.center();
            let _ = window.set_focus();
            Ok(true)
        } else {
            let _ = window.hide();
            Ok(false)
        }
    } else {
        Err("HUD window not found".to_string())
    }
}

#[tauri::command]
pub async fn resize_hud_window(app: AppHandle, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("hud") {
        window
            .set_size(tauri::LogicalSize::new(640.0, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use crate::core::AppState;
use crate::modules::shortcuts::service::ShortcutService;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();
    let config = state.config_manager.get_app_config();
    let is_zh = config.language == "zh";

    let show_text = if is_zh { "显示主窗口" } else { "Show TheBerry" };
    let hud_text = if is_zh { "呼出 HUD 快捷窗口 (Alt+Space)" } else { "Toggle HUD (Alt+Space)" };
    let shortcut_text = if config.global_shortcuts_enabled {
        if is_zh { "✓ 全局快捷键已启用" } else { "✓ Global Shortcuts Enabled" }
    } else {
        if is_zh { "  启用全局快捷键" } else { "  Enable Global Shortcuts" }
    };
    let quit_text = if is_zh { "退出" } else { "Quit" };

    let show_item = MenuItem::with_id(app, "show", show_text, true, None::<&str>)?;
    let hud_item = MenuItem::with_id(app, "toggle_hud", hud_text, true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let shortcut_item = MenuItem::with_id(app, "toggle_shortcuts", shortcut_text, true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", quit_text, true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_item,
        &hud_item,
        &separator1,
        &shortcut_item,
        &separator2,
        &quit_item,
    ])?;

    let shortcut_item_clone = shortcut_item.clone();

    let builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("TheBerry")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "toggle_hud" => {
                ShortcutService::on_hud_shortcut_pressed(app);
            }
            "toggle_shortcuts" => {
                let state = app.state::<AppState>();
                let mut cfg = state.config_manager.get_app_config();
                cfg.global_shortcuts_enabled = !cfg.global_shortcuts_enabled;
                let new_state = cfg.global_shortcuts_enabled;
                let is_zh = cfg.language == "zh";

                if let Some(root) = state.config_manager.get_data_dir() {
                    let _ = state.config_manager.save_app_config(&root, &cfg);
                }

                let _ = ShortcutService::set_enabled(app, new_state, &cfg.hud_shortcut);

                let updated_label = if new_state {
                    if is_zh { "✓ 全局快捷键已启用" } else { "✓ Global Shortcuts Enabled" }
                } else {
                    if is_zh { "  启用全局快捷键" } else { "  Enable Global Shortcuts" }
                };
                let _ = shortcut_item_clone.set_text(updated_label);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        let _ = builder.icon(icon.clone()).build(app)?;
    } else {
        let _ = builder.build(app)?;
    }

    Ok(())
}

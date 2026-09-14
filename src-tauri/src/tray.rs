use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use crate::core::AppState;
use crate::modules::clipboard::service::ClipboardService;
use crate::modules::shortcuts::service::ShortcutService;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();
    let config = state.config_manager.get_app_config();
    let is_zh = config.language == "zh";

    let show_text = if is_zh { "显示主窗口" } else { "Show TheBerry" };
    let hud_text = if is_zh { "呼出 Spotlight HUD (Alt+Space)" } else { "Toggle Spotlight HUD (Alt+Space)" };
    let clear_clips_text = if is_zh { "清空未固定剪贴板记录" } else { "Clear Unpinned Clips" };
    let image_converter_text = if is_zh { "快速图片格式转换" } else { "Quick Convert Image" };
    
    let lang_menu_text = if is_zh { "切换界面语言" } else { "Switch Language" };
    let lang_en_text = if !is_zh { "✓ English" } else { "  English" };
    let lang_zh_text = if is_zh { "✓ 简体中文" } else { "  简体中文" };

    let shortcut_text = if config.global_shortcuts_enabled {
        if is_zh { "✓ 全局快捷键已启用" } else { "✓ Global Shortcuts Enabled" }
    } else {
        if is_zh { "  启用全局快捷键" } else { "  Enable Global Shortcuts" }
    };
    let quit_text = if is_zh { "退出 TheBerry" } else { "Quit TheBerry" };

    let show_item = MenuItem::with_id(app, "show", show_text, true, None::<&str>)?;
    let hud_item = MenuItem::with_id(app, "toggle_hud", hud_text, true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    let clear_clips_item = MenuItem::with_id(app, "clear_unpinned_clips", clear_clips_text, true, None::<&str>)?;
    let image_conv_item = MenuItem::with_id(app, "quick_image_converter", image_converter_text, true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let lang_en_item = MenuItem::with_id(app, "lang_en", lang_en_text, true, None::<&str>)?;
    let lang_zh_item = MenuItem::with_id(app, "lang_zh", lang_zh_text, true, None::<&str>)?;
    let lang_submenu = Submenu::with_items(app, lang_menu_text, true, &[&lang_en_item, &lang_zh_item])?;

    let shortcut_item = MenuItem::with_id(app, "toggle_shortcuts", shortcut_text, true, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", quit_text, true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_item,
        &hud_item,
        &sep1,
        &clear_clips_item,
        &image_conv_item,
        &sep2,
        &lang_submenu,
        &shortcut_item,
        &sep3,
        &quit_item,
    ])?;

    let shortcut_item_clone = shortcut_item.clone();
    let lang_en_clone = lang_en_item.clone();
    let lang_zh_clone = lang_zh_item.clone();

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
            "clear_unpinned_clips" => {
                let state = app.state::<AppState>();
                let clip_service = ClipboardService::new(state.db_manager.clone());
                if let Ok(count) = clip_service.clear_unpinned() {
                    let _ = app.emit("clipboard-cleared", count);
                }
            }
            "quick_image_converter" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = app.emit("navigate-view", "image_converter");
            }
            "lang_en" => {
                let state = app.state::<AppState>();
                let mut cfg = state.config_manager.get_app_config();
                cfg.language = "en".to_string();
                if let Some(root) = state.config_manager.get_data_dir() {
                    let _ = state.config_manager.save_app_config(&root, &cfg);
                }
                let _ = lang_en_clone.set_text("✓ English");
                let _ = lang_zh_clone.set_text("  简体中文");
                let _ = app.emit("language-changed", "en");
            }
            "lang_zh" => {
                let state = app.state::<AppState>();
                let mut cfg = state.config_manager.get_app_config();
                cfg.language = "zh".to_string();
                if let Some(root) = state.config_manager.get_data_dir() {
                    let _ = state.config_manager.save_app_config(&root, &cfg);
                }
                let _ = lang_en_clone.set_text("  English");
                let _ = lang_zh_clone.set_text("✓ 简体中文");
                let _ = app.emit("language-changed", "zh");
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

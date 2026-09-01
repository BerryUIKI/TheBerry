pub mod commands;
pub mod core;
pub mod modules;
pub mod tray;

use core::AppState;
use std::str::FromStr;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    let db_manager_for_listener = app_state.db_manager.clone();
    let config_manager_for_setup = app_state.config_manager.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            ShortcutBuilder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let state = app.state::<AppState>();
                        let cfg = state.config_manager.get_app_config();
                        if cfg.global_shortcuts_enabled {
                            if let Ok(hud_sc) = Shortcut::from_str(&cfg.hud_shortcut) {
                                if shortcut == &hud_sc {
                                    modules::shortcuts::service::ShortcutService::on_hud_shortcut_pressed(app);
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(app_state)
        .setup(move |app| {
            if let Err(e) = tray::setup_tray(app.handle()) {
                tracing::warn!("Failed to setup tray icon: {}", e);
            }

            // Register initial global shortcut if enabled
            let cfg = config_manager_for_setup.get_app_config();
            if cfg.global_shortcuts_enabled {
                if let Err(e) = modules::shortcuts::service::ShortcutService::register_hud_shortcut(
                    app.handle(),
                    &cfg.hud_shortcut,
                ) {
                    tracing::warn!("Failed to register initial global shortcut: {}", e);
                }
            }

            // Setup HUD window auto-hide on blur (focus loss)
            if let Some(hud_win) = app.get_webview_window("hud") {
                let hud_clone = hud_win.clone();
                hud_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = hud_clone.hide();
                    }
                });
            }

            // Start background system clipboard monitoring daemon
            modules::clipboard::service::ClipboardService::start_listener(
                db_manager_for_listener,
                app.handle().clone(),
            );

            // Start background daily version check daemon
            modules::updater::service::UpdaterService::start_daily_check_daemon(
                app.handle().clone(),
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System & Config
            commands::system::get_app_status,
            commands::system::initialize_data_dir,
            commands::system::get_config,
            commands::system::update_config,
            // Window controls
            commands::window::minimize_window,
            commands::window::toggle_maximize_window,
            commands::window::close_window,
            commands::window::show_main_window,
            commands::window::toggle_hud_window,
            // Shortcuts Module
            modules::shortcuts::commands::set_global_shortcuts_enabled,
            modules::shortcuts::commands::set_hud_shortcut,
            // Clipboard Module
            modules::clipboard::commands::get_clipboard_history,
            modules::clipboard::commands::search_clipboard_history,
            modules::clipboard::commands::add_clipboard_item,
            modules::clipboard::commands::toggle_clipboard_pin,
            modules::clipboard::commands::delete_clipboard_item,
            modules::clipboard::commands::clear_clipboard_history,
            modules::clipboard::commands::copy_to_system_clipboard,
            modules::clipboard::commands::copy_image_to_system_clipboard,
            // Autostart Module
            modules::autostart::commands::is_autostart_enabled,
            modules::autostart::commands::set_autostart,
            // Snippets Module
            modules::snippets::commands::get_snippets,
            modules::snippets::commands::save_snippet,
            modules::snippets::commands::delete_snippet,
            modules::snippets::commands::expand_snippet_template,
            modules::snippets::commands::copy_expanded_snippet,
            // Launcher Module
            modules::launcher::commands::get_launcher_items,
            modules::launcher::commands::save_launcher_item,
            modules::launcher::commands::delete_launcher_item,
            modules::launcher::commands::launch_item,
            modules::launcher::commands::discover_system_apps,
            modules::launcher::commands::batch_import_launcher_items,
            // Image Converter Module
            modules::image_converter::commands::convert_images,
            // File Search Module
            modules::file_search::commands::search_files,
            modules::file_search::commands::get_system_drives,
            modules::file_search::commands::reveal_in_explorer,
            modules::file_search::commands::open_file_path,
            // Updater Module
            modules::updater::commands::check_for_updates,
            modules::updater::commands::download_and_install_update,
            modules::updater::commands::get_app_version,
            // Backup Module
            modules::backup::commands::export_full_backup,
            modules::backup::commands::import_full_backup,
            // Goose AI Assistant Module
            modules::goose::commands::get_goose_status,
            modules::goose::commands::start_goose_daemon,
            modules::goose::commands::stop_goose_daemon,
            modules::goose::commands::send_goose_message,
            modules::goose::commands::set_goose_custom_binary_path,
            modules::goose::commands::get_ai_config,
            modules::goose::commands::save_ai_config,
            modules::goose::commands::fetch_provider_models,
            // QuickLook Windows-Only Preview Module
            modules::quicklook::commands::get_quicklook_status,
            modules::quicklook::commands::quicklook_preview,
            modules::quicklook::commands::quicklook_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TheBerry application");
}

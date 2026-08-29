pub mod commands;
pub mod core;
pub mod modules;
pub mod tray;

use core::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            if let Err(e) = tray::setup_tray(app.handle()) {
                tracing::warn!("Failed to setup tray icon: {}", e);
            }
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
            // Clipboard Module
            modules::clipboard::commands::get_clipboard_history,
            modules::clipboard::commands::add_clipboard_item,
            modules::clipboard::commands::toggle_clipboard_pin,
            modules::clipboard::commands::delete_clipboard_item,
            modules::clipboard::commands::clear_clipboard_history,
            // Snippets Module
            modules::snippets::commands::get_snippets,
            modules::snippets::commands::save_snippet,
            modules::snippets::commands::delete_snippet,
            // Launcher Module
            modules::launcher::commands::get_launcher_items,
            modules::launcher::commands::save_launcher_item,
            modules::launcher::commands::delete_launcher_item,
            modules::launcher::commands::launch_item,
            // Image Converter Module
            modules::image_converter::commands::convert_images,
            // File Search Module
            modules::file_search::commands::search_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TheBerry application");
}

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use tauri::State;

use crate::core::{logging, AppState};

const MAX_LOG_BYTES: usize = 256 * 1024;

/// Records a frontend error in the backend log so it appears in diagnostics exports.
#[tauri::command]
pub fn log_frontend_error(message: String, stack: Option<String>) {
    match stack.filter(|stack| !stack.trim().is_empty()) {
        Some(stack) => tracing::error!("frontend error: {message}\n{stack}"),
        None => tracing::error!("frontend error: {message}"),
    }
}

/// Writes a redacted diagnostics report (versions, configuration, recent logs) to Downloads.
#[tauri::command]
pub fn export_diagnostics(state: State<AppState>) -> Result<String, String> {
    let data_dir = state
        .config_manager
        .get_data_dir()
        .ok_or_else(|| "The data directory is not initialized".to_string())?;
    let config = state.config_manager.get_app_config();
    let ai = state.goose_service.get_ai_config();

    let mut report = String::new();
    let _ = writeln!(report, "TheBerry diagnostics");
    let _ = writeln!(report, "generated: {}", chrono::Local::now().to_rfc3339());
    let _ = writeln!(report);
    let _ = writeln!(report, "== Application ==");
    let _ = writeln!(report, "version: {}", env!("CARGO_PKG_VERSION"));
    let _ = writeln!(report, "os: {}", std::env::consts::OS);
    let _ = writeln!(report, "arch: {}", std::env::consts::ARCH);
    let _ = writeln!(report, "data_dir: {}", data_dir.display());
    let _ = writeln!(report);
    let _ = writeln!(report, "== Configuration ==");
    let _ = writeln!(report, "theme: {}", config.theme);
    let _ = writeln!(report, "language: {}", config.language);
    let _ = writeln!(report, "close_to_tray: {}", config.close_to_tray);
    let _ = writeln!(report, "autostart: {}", config.autostart);
    let _ = writeln!(
        report,
        "global_shortcuts_enabled: {}",
        config.global_shortcuts_enabled
    );
    let _ = writeln!(report, "hud_shortcut: {}", config.hud_shortcut);
    let _ = writeln!(
        report,
        "clipboard_history_limit: {}",
        config.clipboard_history_limit
    );
    let _ = writeln!(
        report,
        "clipboard_monitor_enabled: {}",
        config.clipboard_monitor_enabled
    );
    let _ = writeln!(report, "quicklook_enabled: {}", config.quicklook_enabled);
    let _ = writeln!(report, "custom_data_dir: {}", config.custom_data_dir);
    let _ = writeln!(report);
    let _ = writeln!(report, "== AI (credentials omitted) ==");
    let _ = writeln!(report, "provider: {}", ai.active_provider);
    let _ = writeln!(report, "request_format: {}", ai.request_format);
    let _ = writeln!(report, "model: {}", ai.model);
    let _ = writeln!(
        report,
        "api_key_configured: {}",
        !ai.api_key.trim().is_empty()
    );
    let _ = writeln!(report);
    let _ = writeln!(report, "== Recent logs ==");

    let logs_dir = logging::logs_dir(&data_dir);
    match latest_log_tail(&logs_dir) {
        Some((path, tail)) => {
            let _ = writeln!(report, "file: {}", path.display());
            let _ = writeln!(report);
            report.push_str(&tail);
        }
        None => {
            let _ = writeln!(report, "No log files found in {}", logs_dir.display());
        }
    }

    let file_name = format!(
        "TheBerry-diagnostics-{}.txt",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    let out_dir = dirs::download_dir().unwrap_or(data_dir);
    let path = out_dir.join(file_name);
    std::fs::write(&path, report)
        .map_err(|e| format!("Failed to write diagnostics to {}: {e}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}

fn latest_log_tail(logs_dir: &Path) -> Option<(PathBuf, String)> {
    let mut files: Vec<_> = std::fs::read_dir(logs_dir)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|kind| kind.is_file()).unwrap_or(false))
        .collect();
    files.sort_by_key(|entry| entry.metadata().and_then(|meta| meta.modified()).ok());
    let latest = files.pop()?;
    let bytes = std::fs::read(latest.path()).ok()?;
    let start = bytes.len().saturating_sub(MAX_LOG_BYTES);
    Some((
        latest.path(),
        String::from_utf8_lossy(&bytes[start..]).into_owned(),
    ))
}

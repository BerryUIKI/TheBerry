use super::types::{FilePreviewInfo, QuickLookPreviewPayload, QuickLookStatus};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

#[cfg(target_os = "windows")]
use super::windows::QuickLookService;

#[cfg(not(target_os = "windows"))]
use super::stub::QuickLookService;

use crate::core::AppState;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn get_quicklook_status(state: State<'_, AppState>) -> Result<QuickLookStatus, String> {
    let cfg = state.config_manager.get_app_config();
    Ok(QuickLookService::get_status(cfg.quicklook_enabled))
}

#[tauri::command]
pub async fn set_quicklook_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<QuickLookStatus, String> {
    let mut cfg = state.config_manager.get_app_config();
    cfg.quicklook_enabled = enabled;
    if let Some(root) = state.config_manager.get_data_dir() {
        let _ = state.config_manager.save_app_config(&root, &cfg);
    }

    if enabled {
        let _ = QuickLookService::start_process();
    } else {
        let _ = QuickLookService::stop_process();
    }

    let status = QuickLookService::get_status(enabled);
    let _ = app.emit("quicklook-status-changed", &status);
    Ok(status)
}

#[tauri::command]
pub async fn start_quicklook(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QuickLookStatus, String> {
    QuickLookService::start_process()?;
    let cfg = state.config_manager.get_app_config();
    let status = QuickLookService::get_status(cfg.quicklook_enabled);
    let _ = app.emit("quicklook-status-changed", &status);
    Ok(status)
}

#[tauri::command]
pub async fn stop_quicklook(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QuickLookStatus, String> {
    QuickLookService::stop_process()?;
    let cfg = state.config_manager.get_app_config();
    let status = QuickLookService::get_status(cfg.quicklook_enabled);
    let _ = app.emit("quicklook-status-changed", &status);
    Ok(status)
}

#[tauri::command]
pub async fn quicklook_preview(
    state: State<'_, AppState>,
    payload: QuickLookPreviewPayload,
) -> Result<bool, String> {
    let cfg = state.config_manager.get_app_config();
    if !cfg.quicklook_enabled {
        return Err("QuickLook is disabled in settings".to_string());
    }
    if !QuickLookService::is_process_running() {
        let _ = QuickLookService::start_process();
    }
    QuickLookService::preview(payload)
}

#[tauri::command]
pub async fn quicklook_close() -> Result<(), String> {
    QuickLookService::close()
}

#[tauri::command]
pub async fn get_quicklook_file_preview(path: String) -> Result<FilePreviewInfo, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file_path.is_file() {
        return Err(format!("Path is not a regular file: {}", path));
    }

    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let size_bytes = metadata.len();
    let modified_timestamp = metadata.modified().ok().and_then(|t| {
        t.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as i64)
    });

    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let extension = file_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let (category, mime_type) = match extension.as_str() {
        "png" => ("image", "image/png"),
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "gif" => ("image", "image/gif"),
        "webp" => ("image", "image/webp"),
        "bmp" => ("image", "image/bmp"),
        "ico" => ("image", "image/x-icon"),
        "svg" => ("image", "image/svg+xml"),
        "mp4" => ("video", "video/mp4"),
        "webm" => ("video", "video/webm"),
        "mov" => ("video", "video/quicktime"),
        "mkv" => ("video", "video/x-matroska"),
        "avi" => ("video", "video/x-msvideo"),
        "mp3" => ("audio", "audio/mpeg"),
        "wav" => ("audio", "audio/wav"),
        "ogg" => ("audio", "audio/ogg"),
        "flac" => ("audio", "audio/flac"),
        "m4a" => ("audio", "audio/mp4"),
        "aac" => ("audio", "audio/aac"),
        "pdf" => ("pdf", "application/pdf"),
        "csv" => ("csv", "text/csv"),
        "tsv" => ("csv", "text/tab-separated-values"),
        "md" | "markdown" | "mdown" | "mkd" => ("markdown", "text/markdown"),
        "json" => ("code", "application/json"),
        "yaml" | "yml" => ("code", "text/yaml"),
        "toml" => ("code", "text/x-toml"),
        "xml" => ("code", "application/xml"),
        "html" | "htm" => ("code", "text/html"),
        "css" | "scss" | "less" => ("code", "text/css"),
        "js" | "mjs" | "cjs" => ("code", "application/javascript"),
        "ts" | "mts" | "cts" | "tsx" | "jsx" => ("code", "application/typescript"),
        "rs" => ("code", "text/x-rust"),
        "py" => ("code", "text/x-python"),
        "c" | "cpp" | "cc" | "cxx" | "h" | "hpp" => ("code", "text/x-c"),
        "cs" => ("code", "text/x-csharp"),
        "java" => ("code", "text/x-java"),
        "go" => ("code", "text/x-go"),
        "sql" => ("code", "text/x-sql"),
        "sh" | "bash" | "zsh" => ("code", "text/x-sh"),
        "bat" | "cmd" | "ps1" => ("code", "text/x-powershell"),
        "txt" | "log" | "ini" | "conf" | "env" => ("text", "text/plain"),
        _ => ("binary", "application/octet-stream"),
    };

    let mut text_preview = None;
    let mut base64_data = None;
    let mut is_truncated = false;

    match category {
        "image" => {
            if extension == "svg" {
                if let Ok(mut f) = File::open(file_path) {
                    let mut buf = Vec::new();
                    let max_read = 2 * 1024 * 1024; // 2MB
                    let _ = f.by_ref().take(max_read).read_to_end(&mut buf);
                    if let Ok(svg_str) = String::from_utf8(buf) {
                        text_preview = Some(svg_str.clone());
                        base64_data = Some(format!("data:image/svg+xml;utf8,{}", urlencoding_simple(&svg_str)));
                    }
                }
            } else if size_bytes <= 30 * 1024 * 1024 {
                if let Ok(bytes) = fs::read(file_path) {
                    base64_data = Some(format!("data:{};base64,{}", mime_type, BASE64.encode(&bytes)));
                }
            }
        }
        "video" | "audio" => {
            if size_bytes <= 40 * 1024 * 1024 {
                if let Ok(bytes) = fs::read(file_path) {
                    base64_data = Some(format!("data:{};base64,{}", mime_type, BASE64.encode(&bytes)));
                }
            }
        }
        "pdf" => {
            if size_bytes <= 25 * 1024 * 1024 {
                if let Ok(bytes) = fs::read(file_path) {
                    base64_data = Some(format!("data:application/pdf;base64,{}", BASE64.encode(&bytes)));
                }
            }
        }
        "code" | "markdown" | "csv" | "text" => {
            let max_read = 512 * 1024; // 512KB
            if let Ok(mut f) = File::open(file_path) {
                let mut buf = Vec::new();
                let read_bytes = f.by_ref().take(max_read + 1).read_to_end(&mut buf).unwrap_or(0);
                if read_bytes as u64 > max_read {
                    buf.truncate(max_read as usize);
                    is_truncated = true;
                }
                text_preview = String::from_utf8(buf).ok();
            }
        }
        _ => {
            if size_bytes <= 100 * 1024 {
                if let Ok(bytes) = fs::read(file_path) {
                    if let Ok(text) = String::from_utf8(bytes) {
                        text_preview = Some(text);
                    }
                }
            }
        }
    }

    Ok(FilePreviewInfo {
        path,
        name,
        extension,
        size_bytes,
        modified_timestamp,
        mime_type: mime_type.to_string(),
        category: category.to_string(),
        text_preview,
        base64_data,
        is_truncated,
    })
}

fn urlencoding_simple(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

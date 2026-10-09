#![cfg(not(target_os = "windows"))]

use super::types::{QuickLookPreviewPayload, QuickLookStatus};

pub struct QuickLookService;

impl QuickLookService {
    pub fn get_status(enabled: bool) -> QuickLookStatus {
        QuickLookStatus {
            is_supported_os: false,
            is_installed: false,
            is_running: false,
            is_enabled: enabled,
            is_embedded: false,
            has_builtin_fallback: true,
            binary_path: None,
            pipe_name: None,
            error_message: Some("QuickLook is only supported on Windows. Built-in previewer active.".to_string()),
        }
    }

    pub fn is_process_running() -> bool {
        false
    }

    pub fn start_process() -> Result<bool, String> {
        Ok(false)
    }

    pub fn stop_process() -> Result<bool, String> {
        Ok(false)
    }

    pub fn preview(_payload: QuickLookPreviewPayload) -> Result<bool, String> {
        Err("QuickLook is only supported on Windows.".to_string())
    }

    pub fn close() -> Result<(), String> {
        Ok(())
    }
}

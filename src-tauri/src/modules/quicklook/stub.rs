#![cfg(not(target_os = "windows"))]

use super::types::{QuickLookPreviewPayload, QuickLookStatus};

pub struct QuickLookService;

impl QuickLookService {
    pub fn get_status() -> QuickLookStatus {
        QuickLookStatus {
            is_supported_os: false,
            is_installed: false,
            is_running: false,
            binary_path: None,
            pipe_name: None,
            error_message: Some("QuickLook is only supported on Windows.".to_string()),
        }
    }

    pub fn preview(_payload: QuickLookPreviewPayload) -> Result<bool, String> {
        Err("QuickLook is only supported on Windows.".to_string())
    }

    pub fn close() -> Result<(), String> {
        Ok(())
    }
}

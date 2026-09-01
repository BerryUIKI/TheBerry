use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickLookStatus {
    pub is_supported_os: bool,
    pub is_installed: bool,
    pub is_running: bool,
    pub binary_path: Option<String>,
    pub pipe_name: Option<String>,
    pub error_message: Option<String>,
}

impl Default for QuickLookStatus {
    fn default() -> Self {
        Self {
            is_supported_os: cfg!(target_os = "windows"),
            is_installed: false,
            is_running: false,
            binary_path: None,
            pipe_name: None,
            error_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickLookPreviewPayload {
    pub path: String,
    pub mode: Option<String>, // "toggle" | "switch" | "preview"
}

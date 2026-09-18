use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickLookStatus {
    pub is_supported_os: bool,
    pub is_installed: bool,
    pub is_running: bool,
    pub is_enabled: bool,
    pub is_embedded: bool,
    pub has_builtin_fallback: bool,
    pub binary_path: Option<String>,
    pub pipe_name: Option<String>,
    pub error_message: Option<String>,
}

#[allow(clippy::derivable_impls)]
impl Default for QuickLookStatus {
    fn default() -> Self {
        Self {
            is_supported_os: cfg!(target_os = "windows"),
            is_installed: false,
            is_running: false,
            is_enabled: true,
            is_embedded: false,
            has_builtin_fallback: true,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePreviewInfo {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub modified_timestamp: Option<i64>,
    pub mime_type: String,
    pub category: String, // "image" | "video" | "audio" | "code" | "markdown" | "pdf" | "csv" | "text" | "binary"
    pub text_preview: Option<String>,
    pub base64_data: Option<String>,
    pub is_truncated: bool,
}

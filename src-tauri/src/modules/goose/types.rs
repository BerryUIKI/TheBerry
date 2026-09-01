use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GooseStatus {
    pub is_running: bool,
    pub is_installed: bool,
    pub binary_path: Option<String>,
    pub port: Option<u16>,
    pub active_model: Option<String>,
    pub active_provider: Option<String>,
    pub error_message: Option<String>,
}

impl Default for GooseStatus {
    fn default() -> Self {
        Self {
            is_running: false,
            is_installed: false,
            binary_path: None,
            port: None,
            active_model: Some("gpt-4o".to_string()),
            active_provider: Some("openai".to_string()),
            error_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendGooseMessagePayload {
    pub session_id: String,
    pub prompt: String,
    pub model: Option<String>,
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GooseStreamChunk {
    pub session_id: String,
    pub message_id: String,
    pub delta: String,
    pub is_finished: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GooseConfig {
    pub binary_path: Option<String>,
    pub default_port: Option<u16>,
    pub auto_start: bool,
    pub default_provider: Option<String>,
    pub default_model: Option<String>,
}

impl Default for GooseConfig {
    fn default() -> Self {
        Self {
            binary_path: None,
            default_port: None,
            auto_start: false,
            default_provider: Some("openai".to_string()),
            default_model: Some("gpt-4o".to_string()),
        }
    }
}

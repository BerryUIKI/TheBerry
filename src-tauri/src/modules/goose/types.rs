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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMcpServer {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub active_provider: String, // "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "groq" | "openrouter" | "custom"
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub system_prompt: String,
    pub enable_developer_tools: bool,
    pub enable_web_fetch: bool,
    pub custom_mcp_servers: Vec<CustomMcpServer>,
    pub goose_binary_path: String,
    pub auto_start_daemon: bool,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            active_provider: "openai".to_string(),
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o".to_string(),
            temperature: 0.7,
            max_tokens: 4096,
            system_prompt: "You are TheBerry, an intelligent, helpful, and concise AI desktop assistant integrated into TheBerry utility suite.".to_string(),
            enable_developer_tools: true,
            enable_web_fetch: true,
            custom_mcp_servers: Vec::new(),
            goose_binary_path: String::new(),
            auto_start_daemon: false,
        }
    }
}


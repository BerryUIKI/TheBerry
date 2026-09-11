use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;
use parking_lot::RwLock;

use super::types::GooseStatus;

pub struct GooseProcessManager {
    child: Mutex<Option<Child>>,
    status: Arc<RwLock<GooseStatus>>,
    port: Mutex<Option<u16>>,
    custom_binary_path: Arc<RwLock<Option<String>>>,
}

impl Default for GooseProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl GooseProcessManager {
    pub fn new() -> Self {
        let binary_path = Self::discover_binary(None);
        let is_installed = binary_path.is_some();
        let binary_path_str = binary_path.map(|p| p.to_string_lossy().to_string());

        let initial_status = GooseStatus {
            is_running: false,
            is_installed,
            binary_path: binary_path_str,
            port: None,
            active_model: Some("gpt-4o".to_string()),
            active_provider: Some("openai".to_string()),
            error_message: None,
        };

        Self {
            child: Mutex::new(None),
            status: Arc::new(RwLock::new(initial_status)),
            port: Mutex::new(None),
            custom_binary_path: Arc::new(RwLock::new(None)),
        }
    }

    /// Dynamically finds an open, available TCP port to eliminate port conflicts.
    pub fn find_available_port(start_port: u16, max_port: u16) -> Option<u16> {
        // First try ephemeral OS-assigned port
        if let Ok(listener) = TcpListener::bind("127.0.0.1:0") {
            if let Ok(addr) = listener.local_addr() {
                return Some(addr.port());
            }
        }

        // Fallback: sequential scan across range
        for port in start_port..=max_port {
            if let Ok(_listener) = TcpListener::bind(("127.0.0.1", port)) {
                return Some(port);
            }
        }
        None
    }

    /// Discovers the goose binary on the host system.
    pub fn discover_binary(custom_path: Option<&str>) -> Option<PathBuf> {
        // 1. Check custom path if provided
        if let Some(cp) = custom_path {
            let path = PathBuf::from(cp);
            if path.is_file() {
                return Some(path);
            }
        }

        // 2. Check standard system PATH
        #[cfg(target_os = "windows")]
        let bin_name = "goose.exe";
        #[cfg(not(target_os = "windows"))]
        let bin_name = "goose";

        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let candidate = dir.join(bin_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        // 3. Check common user directories
        if let Some(home) = dirs::home_dir() {
            let cargo_bin = home.join(".cargo").join("bin").join(bin_name);
            if cargo_bin.is_file() {
                return Some(cargo_bin);
            }

            let local_bin = home.join(".local").join("bin").join(bin_name);
            if local_bin.is_file() {
                return Some(local_bin);
            }

            #[cfg(target_os = "windows")]
            {
                if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                    let prog_bin = Path::new(&local_app_data)
                        .join("Programs")
                        .join("goose")
                        .join(bin_name);
                    if prog_bin.is_file() {
                        return Some(prog_bin);
                    }
                }
            }
        }

        None
    }

    /// Returns the current Goose status.
    pub fn get_status(&self) -> GooseStatus {
        let mut status = self.status.read().clone();
        // Re-check installation if previously false
        if !status.is_installed {
            let custom = self.custom_binary_path.read().clone();
            if let Some(bin) = Self::discover_binary(custom.as_deref()) {
                status.is_installed = true;
                status.binary_path = Some(bin.to_string_lossy().to_string());
                *self.status.write() = status.clone();
            }
        }
        status
    }

    /// Sets a custom binary path.
    pub fn set_custom_binary_path(&self, path: Option<String>) {
        *self.custom_binary_path.write() = path.clone();
        let bin = Self::discover_binary(path.as_deref());
        let mut status = self.status.write();
        status.is_installed = bin.is_some();
        status.binary_path = bin.map(|p| p.to_string_lossy().to_string());
    }

    /// Starts the Goose daemon process on an automatically allocated conflict-free port.
    pub async fn start_server(&self, custom_port: Option<u16>) -> Result<GooseStatus, String> {
        let mut child_guard = self.child.lock().await;

        if child_guard.is_some() {
            return Ok(self.get_status());
        }

        let custom_bin = self.custom_binary_path.read().clone();
        let binary_path = Self::discover_binary(custom_bin.as_deref())
            .ok_or_else(|| "Goose binary not found. Please install Goose or configure the path in settings.".to_string())?;

        let port = match custom_port {
            Some(p) => p,
            None => Self::find_available_port(3001, 3050)
                .ok_or_else(|| "No available port found for Goose daemon.".to_string())?,
        };

        tracing::info!("Starting Goose daemon on 127.0.0.1:{} using {:?}", port, binary_path);

        let mut cmd = tokio::process::Command::new(&binary_path);
        cmd.arg("serve")
           .arg("--port")
           .arg(port.to_string())
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            // Set CREATE_NO_WINDOW (0x08000000) on Windows to run silently in background
            cmd.creation_flags(0x08000000);
        }

        match cmd.spawn() {
            Ok(child) => {
                *child_guard = Some(child);
                *self.port.lock().await = Some(port);

                let mut status = self.status.write();
                status.is_running = true;
                status.is_installed = true;
                status.port = Some(port);
                status.binary_path = Some(binary_path.to_string_lossy().to_string());
                status.error_message = None;

                Ok(status.clone())
            }
            Err(e) => {
                let err_msg = format!("Failed to spawn Goose server: {}", e);
                tracing::error!("{}", err_msg);
                let mut status = self.status.write();
                status.is_running = false;
                status.error_message = Some(err_msg.clone());
                Err(err_msg)
            }
        }
    }

    /// Stops the running Goose server process.
    pub async fn stop_server(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            tracing::info!("Terminating Goose server process...");
            let _ = child.kill().await;
        }

        *self.port.lock().await = None;

        let mut status = self.status.write();
        status.is_running = false;
        status.port = None;

        Ok(())
    }

    /// Gets the current active port if running.
    pub async fn get_active_port(&self) -> Option<u16> {
        *self.port.lock().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_available_port() {
        let port = GooseProcessManager::find_available_port(3001, 3050);
        assert!(port.is_some(), "Should find an open port");
        let p = port.unwrap();
        assert!(p > 0, "Port must be greater than 0");
    }

    #[test]
    fn test_process_manager_initial_status() {
        let manager = GooseProcessManager::new();
        let status = manager.get_status();
        assert!(!status.is_running, "Initial status should not be running");
        assert_eq!(status.port, None);
    }

    #[test]
    fn test_custom_binary_path_setting() {
        let manager = GooseProcessManager::new();
        manager.set_custom_binary_path(Some("non_existent_goose_bin_12345".to_string()));
        let status = manager.get_status();
        assert!(!status.is_installed, "Non-existent path should not be marked installed");
    }

    #[test]
    fn test_ai_config_request_format_defaults() {
        use crate::modules::goose::types::AIConfig;
        let default_cfg = AIConfig::default();
        assert_eq!(default_cfg.request_format, "openai");
        assert_eq!(default_cfg.active_provider, "openai");

        let json = r#"{"active_provider":"anthropic","api_key":"sk-ant-test","base_url":"https://api.anthropic.com/v1","model":"claude-3-5-sonnet","temperature":0.7,"max_tokens":4096,"system_prompt":"","enable_developer_tools":true,"enable_web_fetch":true,"custom_mcp_servers":[],"goose_binary_path":"","auto_start_daemon":false}"#;
        let parsed: AIConfig = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.request_format, "openai", "Default serde fallback when field is omitted");
    }

    #[test]
    fn test_extract_ollama_ndjson_delta() {
        let chunk_str = r#"{"model":"qwen2.5:3b","created_at":"2026-09-01T11:38:23.6934651Z","message":{"role":"assistant","content":"您好"},"done":false}"#;
        let json: serde_json::Value = serde_json::from_str(chunk_str).unwrap();
        let content = json.pointer("/message/content").and_then(|v| v.as_str());
        assert_eq!(content, Some("您好"));
        assert_eq!(json.get("done").and_then(|v| v.as_bool()), Some(false));

        let done_chunk_str = r#"{"model":"qwen2.5:3b","created_at":"2026-09-01T11:38:24.5414181Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}"#;
        let done_json: serde_json::Value = serde_json::from_str(done_chunk_str).unwrap();
        assert_eq!(done_json.get("done").and_then(|v| v.as_bool()), Some(true));
    }
}


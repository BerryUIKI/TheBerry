use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub is_running: bool,
    pub is_installed: bool,
    pub binary_path: Option<String>,
    pub port: u16,
    pub models: Vec<String>,
    pub error_message: Option<String>,
}

impl Default for OllamaStatus {
    fn default() -> Self {
        Self {
            is_running: false,
            is_installed: false,
            binary_path: None,
            port: 11434,
            models: Vec::new(),
            error_message: None,
        }
    }
}

pub struct OllamaProcessManager {
    child: Mutex<Option<Child>>,
    status: Arc<RwLock<OllamaStatus>>,
    custom_binary_path: Arc<RwLock<Option<String>>>,
    http_client: reqwest::Client,
}

impl Default for OllamaProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl OllamaProcessManager {
    pub fn new() -> Self {
        let binary = Self::discover_binary(None);
        let is_installed = binary.is_some();
        let binary_path = binary.map(|p| p.to_string_lossy().to_string());

        let initial_status = OllamaStatus {
            is_running: false,
            is_installed,
            binary_path,
            port: 11434,
            models: Vec::new(),
            error_message: None,
        };

        Self {
            child: Mutex::new(None),
            status: Arc::new(RwLock::new(initial_status)),
            custom_binary_path: Arc::new(RwLock::new(None)),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(800))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Discovers the Ollama executable on the host system across common paths and PATH.
    pub fn discover_binary(custom_path: Option<&str>) -> Option<PathBuf> {
        // 1. Check custom path if provided
        if let Some(cp) = custom_path {
            let p = PathBuf::from(cp);
            if p.is_file() {
                return Some(p);
            }
        }

        #[cfg(target_os = "windows")]
        let bin_name = "ollama.exe";
        #[cfg(not(target_os = "windows"))]
        let bin_name = "ollama";

        // 2. Windows standard installation locations
        #[cfg(target_os = "windows")]
        {
            // %LOCALAPPDATA%\Programs\Ollama\ollama.exe
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let candidate = PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("Ollama")
                    .join(bin_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
            // %ProgramFiles%\Ollama\ollama.exe
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                let candidate = PathBuf::from(prog_files).join("Ollama").join(bin_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        // 3. Check system PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let candidate = dir.join(bin_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        // 4. macOS / Linux standard locations
        #[cfg(not(target_os = "windows"))]
        {
            let standard_paths = [
                "/usr/local/bin/ollama",
                "/opt/homebrew/bin/ollama",
                "/usr/bin/ollama",
                "/Applications/Ollama.app/Contents/Resources/ollama",
            ];
            for p in &standard_paths {
                let candidate = PathBuf::from(p);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
            if let Some(home) = dirs::home_dir() {
                let candidate = home.join(".local").join("bin").join("ollama");
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        None
    }

    /// Fast, non-blocking check if Ollama daemon is currently responding on target host & port.
    pub async fn check_running(&self, host: &str, port: u16) -> bool {
        let url = format!("http://{}:{}/", host, port);
        match self.http_client.get(&url).send().await {
            Ok(resp) => resp.status().is_success() || resp.status().as_u16() == 404,
            Err(_) => false,
        }
    }

    /// Retrieves list of installed local models from Ollama's /api/tags endpoint.
    pub async fn fetch_models(&self, host: &str, port: u16) -> Vec<String> {
        let url = format!("http://{}:{}/api/tags", host, port);
        let mut models = Vec::new();
        if let Ok(resp) = self.http_client.get(&url).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(list) = json.get("models").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                            models.push(name.to_string());
                        }
                    }
                }
            }
        }
        models
    }

    /// Retrieves current Ollama status with live health-check.
    pub async fn get_status(&self) -> OllamaStatus {
        let host = "127.0.0.1";
        let port = self.status.read().port;
        let is_running = self.check_running(host, port).await;

        let custom = self.custom_binary_path.read().clone();
        let binary = Self::discover_binary(custom.as_deref());
        let is_installed = binary.is_some();
        let binary_path = binary.map(|p| p.to_string_lossy().to_string());

        let models = if is_running {
            self.fetch_models(host, port).await
        } else {
            Vec::new()
        };

        let mut status = self.status.write();
        status.is_running = is_running;
        status.is_installed = is_installed;
        status.binary_path = binary_path;
        status.models = models;
        status.clone()
    }

    /// Sets custom binary path.
    pub fn set_custom_binary_path(&self, path: Option<String>) {
        *self.custom_binary_path.write() = path.clone();
        let bin = Self::discover_binary(path.as_deref());
        let mut status = self.status.write();
        status.is_installed = bin.is_some();
        status.binary_path = bin.map(|p| p.to_string_lossy().to_string());
    }

    /// Ensures the Ollama background daemon is active.
    /// If not running, spawns `ollama serve` silently in the background (no console window).
    pub async fn ensure_running(&self, custom_path: Option<&str>, port: u16) -> Result<OllamaStatus, String> {
        let host = "127.0.0.1";

        // 1. If already running, return status immediately without doing anything
        if self.check_running(host, port).await {
            return Ok(self.get_status().await);
        }

        let mut child_guard = self.child.lock().await;
        // Double-check under lock
        if self.check_running(host, port).await {
            return Ok(self.get_status().await);
        }

        let binary = Self::discover_binary(custom_path)
            .ok_or_else(|| "Ollama executable not found. Please install Ollama from https://ollama.com or configure binary path.".to_string())?;

        tracing::info!("Launching Ollama daemon in background: {:?}", binary);

        let mut cmd = tokio::process::Command::new(&binary);
        cmd.arg("serve")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());

        #[cfg(target_os = "windows")]
        {
            // Set CREATE_NO_WINDOW (0x08000000) on Windows to hide console window completely
            cmd.creation_flags(0x08000000);
        }

        let child = cmd.spawn().map_err(|e| format!("Failed to spawn Ollama process: {}", e))?;
        *child_guard = Some(child);

        // 2. Poll up to 15 times (3 seconds total) for Ollama to start listening
        let mut ready = false;
        for _ in 0..15 {
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            if self.check_running(host, port).await {
                ready = true;
                break;
            }
        }

        let models = if ready {
            self.fetch_models(host, port).await
        } else {
            Vec::new()
        };

        let mut status = self.status.write();
        status.is_running = ready;
        status.is_installed = true;
        status.binary_path = Some(binary.to_string_lossy().to_string());
        status.port = port;
        status.models = models;

        if ready {
            status.error_message = None;
            tracing::info!("Ollama daemon successfully started and listening on port {}", port);
            Ok(status.clone())
        } else {
            let err = "Ollama process launched but server did not respond on port in time.".to_string();
            status.error_message = Some(err.clone());
            Err(err)
        }
    }

    /// Stops the Ollama process if it was spawned by TheBerry.
    pub async fn stop_server(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill().await;
            tracing::info!("Terminated Ollama daemon child process");
        }
        let mut status = self.status.write();
        status.is_running = false;
        Ok(())
    }
}

use futures_util::StreamExt;
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use super::process::GooseProcessManager;
use super::types::{AIConfig, GooseStatus, GooseStreamChunk, SendGooseMessagePayload};

#[derive(Default)]
struct LocalToolCallDelta {
    id: String,
    name: String,
    arguments: String,
}

impl LocalToolCallDelta {
    fn as_json(self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "type": "function",
            "function": {
                "name": self.name,
                "arguments": if self.arguments.is_empty() { "{}".to_string() } else { self.arguments }
            }
        })
    }
}

pub struct GooseService {
    process_manager: Arc<GooseProcessManager>,
    ollama_manager: Arc<super::ollama::OllamaProcessManager>,
    local_manager: Arc<super::local::LocalInferenceManager>,
    http_client: reqwest::Client,
    ai_config: RwLock<AIConfig>,
    active_cancellations: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl Default for GooseService {
    fn default() -> Self {
        Self::new()
    }
}

impl GooseService {
    pub fn new() -> Self {
        let data_dir = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("Documents"))
            .join("BerryAppData");
        Self::new_with_data_dir(data_dir)
    }

    pub fn new_with_data_dir(data_dir: PathBuf) -> Self {
        let default_cfg = AIConfig::default();
        let loaded_cfg = Self::load_persisted_config().unwrap_or(default_cfg);

        Self {
            process_manager: Arc::new(GooseProcessManager::new()),
            ollama_manager: Arc::new(super::ollama::OllamaProcessManager::new()),
            local_manager: Arc::new(super::local::LocalInferenceManager::new(data_dir)),
            http_client: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(30))
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
            ai_config: RwLock::new(loaded_cfg),
            active_cancellations: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Aborts any running AI generation for the specified session_id.
    pub fn abort_message(&self, session_id: &str) -> bool {
        let mut map = self.active_cancellations.lock().unwrap();
        if let Some(flag) = map.remove(session_id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    fn register_cancellation(&self, session_id: &str) -> Arc<AtomicBool> {
        let mut map = self.active_cancellations.lock().unwrap();
        if let Some(existing) = map.get(session_id) {
            existing.store(true, Ordering::SeqCst);
        }
        let flag = Arc::new(AtomicBool::new(false));
        map.insert(session_id.to_string(), flag.clone());
        flag
    }

    fn clear_cancellation(&self, session_id: &str) {
        let mut map = self.active_cancellations.lock().unwrap();
        map.remove(session_id);
    }

    fn get_config_path() -> Option<std::path::PathBuf> {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .or_else(|_| std::env::var("APPDATA"))
            .or_else(|_| std::env::var("HOME"))
            .ok()?;
        let dir = std::path::Path::new(&local_app_data).join("TheBerry");
        let _ = std::fs::create_dir_all(&dir);
        Some(dir.join("ai_config.json"))
    }

    fn load_persisted_config() -> Option<AIConfig> {
        let path = Self::get_config_path()?;
        let mut config: AIConfig = if path.exists() {
            let data = std::fs::read_to_string(path).ok()?;
            serde_json::from_str(&data).ok()?
        } else {
            AIConfig::default()
        };

        // Load API key securely from keyring / Credential Manager
        if let Ok(entry) = keyring::Entry::new("TheBerry", "goose_ai_api_key") {
            if let Ok(sec_key) = entry.get_password() {
                if !sec_key.is_empty() {
                    config.api_key = sec_key;
                }
            }
        }

        Some(config)
    }

    pub fn get_ai_config(&self) -> AIConfig {
        self.ai_config.read().unwrap().clone()
    }

    pub fn save_ai_config(&self, config: AIConfig) -> Result<(), String> {
        // Store API key securely in keyring
        let api_key = config.api_key.clone();
        if let Ok(entry) = keyring::Entry::new("TheBerry", "goose_ai_api_key") {
            if api_key.trim().is_empty() {
                let _ = entry.delete_credential();
            } else {
                let _ = entry.set_password(&api_key);
            }
        }

        if let Some(path) = Self::get_config_path() {
            let mut file_config = config.clone();
            file_config.api_key = String::new(); // Do not write sensitive key in plaintext to disk
            let data = serde_json::to_string_pretty(&file_config)
                .map_err(|e| format!("Failed to serialize AI config: {}", e))?;
            std::fs::write(path, data)
                .map_err(|e| format!("Failed to write AI config to disk: {}", e))?;
        }
        *self.ai_config.write().unwrap() = config;
        Ok(())
    }

    pub fn get_process_manager(&self) -> Arc<GooseProcessManager> {
        self.process_manager.clone()
    }

    pub fn get_status(&self) -> GooseStatus {
        let mut status = self.process_manager.get_status();
        let cfg = self.ai_config.read().unwrap();
        status.active_model = Some(cfg.model.clone());
        status.active_provider = Some(cfg.active_provider.clone());
        status
    }

    pub async fn start_daemon(&self, custom_port: Option<u16>) -> Result<GooseStatus, String> {
        self.process_manager.start_server(custom_port).await
    }

    pub async fn stop_daemon(&self) -> Result<(), String> {
        self.process_manager.stop_server().await
    }

    pub async fn ensure_ollama_running(&self) -> Result<super::ollama::OllamaStatus, String> {
        let custom_path = {
            let cfg = self.ai_config.read().unwrap();
            if !cfg.ollama_binary_path.trim().is_empty() {
                Some(cfg.ollama_binary_path.clone())
            } else {
                None
            }
        };
        self.ollama_manager
            .ensure_running(custom_path.as_deref(), 11434)
            .await
    }

    pub async fn get_ollama_status(&self) -> super::ollama::OllamaStatus {
        self.ollama_manager.get_status().await
    }

    pub async fn stop_ollama_daemon(&self) -> Result<(), String> {
        self.ollama_manager.stop_server().await
    }

    pub fn list_local_models(&self) -> Result<Vec<super::local::LocalModel>, String> {
        self.local_manager.list_models()
    }

    pub fn set_local_model_data_dir(&self, data_dir: PathBuf) {
        self.local_manager.set_data_dir(data_dir);
    }

    pub async fn get_local_runtime_status(&self) -> super::local::LocalRuntimeStatus {
        self.local_manager.status().await
    }

    pub async fn start_local_runtime(
        &self,
        app_handle: &AppHandle,
        model_id: &str,
    ) -> Result<super::local::LocalRuntimeStatus, String> {
        let resource_dir = app_handle.path().resource_dir().ok();
        self.local_manager.start(resource_dir, model_id).await
    }

    pub async fn stop_local_runtime(&self) -> Result<(), String> {
        self.local_manager.stop().await
    }

    pub async fn download_local_model(
        &self,
        app_handle: AppHandle,
        model_id: &str,
    ) -> Result<(), String> {
        self.local_manager
            .download_catalog_model(app_handle, model_id)
            .await
    }

    pub fn cancel_local_model_download(&self, model_id: &str) -> bool {
        self.local_manager.cancel_download(model_id)
    }

    pub fn import_local_model(
        &self,
        source_path: &str,
    ) -> Result<super::local::LocalModel, String> {
        self.local_manager.import_model(source_path)
    }

    pub async fn remove_local_model(&self, model_id: &str) -> Result<(), String> {
        self.local_manager.remove_model(model_id).await
    }

    pub async fn fetch_provider_models(
        &self,
        provider: String,
        base_url: Option<String>,
        api_key: Option<String>,
        request_format: Option<String>,
    ) -> Result<Vec<String>, String> {
        let raw_provider = provider.to_lowercase();
        let format = request_format.unwrap_or_else(|| raw_provider.clone());
        let raw_key = api_key.unwrap_or_default().trim().to_string();
        let base = base_url.unwrap_or_default().trim().to_string();

        match format.as_str() {
            "gemini" => {
                let url = if base.is_empty() {
                    "https://generativelanguage.googleapis.com/v1beta/models".to_string()
                } else if base.contains("/models") {
                    base
                } else {
                    format!("{}/models", base.trim_end_matches('/'))
                };

                let mut req = self.http_client.get(&url);
                if !raw_key.is_empty() {
                    req = req.header("X-goog-api-key", &raw_key);
                }

                let resp = req
                    .send()
                    .await
                    .map_err(|e| format!("Gemini request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Gemini error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse Gemini JSON: {}", e))?;
                let mut models = Vec::new();
                if let Some(list) = json.get("models").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                            let clean_name = name.strip_prefix("models/").unwrap_or(name);
                            models.push(clean_name.to_string());
                        }
                    }
                }
                if models.is_empty() {
                    models = vec![
                        "gemini-2.5-flash".to_string(),
                        "gemini-2.5-pro".to_string(),
                        "gemini-1.5-flash".to_string(),
                        "gemini-1.5-pro".to_string(),
                    ];
                }
                Ok(models)
            }
            "ollama" => {
                let auto_start = {
                    let cfg = self.ai_config.read().unwrap();
                    cfg.auto_start_ollama
                };
                if auto_start {
                    let _ = self.ensure_ollama_running().await;
                }

                let url = if base.is_empty() {
                    "http://localhost:11434/api/tags".to_string()
                } else if base.ends_with("/api/tags") || base.ends_with("/v1/models") {
                    base
                } else {
                    format!("{}/api/tags", base.trim_end_matches('/'))
                };

                let resp = self
                    .http_client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| format!("Ollama request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Ollama error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse Ollama JSON: {}", e))?;
                let mut models = Vec::new();
                if let Some(list) = json.get("models").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                            models.push(name.to_string());
                        }
                    }
                }
                Ok(models)
            }
            "anthropic" => {
                let url = if base.is_empty() {
                    "https://api.anthropic.com/v1/models".to_string()
                } else {
                    format!("{}/models", base.trim_end_matches('/'))
                };

                let mut req = self
                    .http_client
                    .get(&url)
                    .header("anthropic-version", "2023-06-01");
                if !raw_key.is_empty() {
                    req = req.header("x-api-key", &raw_key);
                }

                let resp = req
                    .send()
                    .await
                    .map_err(|e| format!("Anthropic request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Anthropic error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse Anthropic JSON: {}", e))?;
                let mut models = Vec::new();
                if let Some(list) = json.get("data").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(id) = m.get("id").and_then(|v| v.as_str()) {
                            models.push(id.to_string());
                        }
                    }
                }
                Ok(models)
            }
            _ => {
                // OpenAI, DeepSeek, Groq, OpenRouter, etc.
                let url = if base.is_empty() {
                    match raw_provider.as_str() {
                        "deepseek" => "https://api.deepseek.com/v1/models".to_string(),
                        "groq" => "https://api.groq.com/openai/v1/models".to_string(),
                        "openrouter" => "https://openrouter.ai/api/v1/models".to_string(),
                        _ => "https://api.openai.com/v1/models".to_string(),
                    }
                } else if base.ends_with("/models") {
                    base
                } else if base.ends_with("/chat/completions") {
                    base.replace("/chat/completions", "/models")
                } else {
                    format!("{}/models", base.trim_end_matches('/'))
                };

                let mut req = self.http_client.get(&url);
                if !raw_key.is_empty() {
                    req = req.header("Authorization", format!("Bearer {}", raw_key));
                }

                let resp = req
                    .send()
                    .await
                    .map_err(|e| format!("Models request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Provider API error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse JSON: {}", e))?;
                let mut models = Vec::new();
                if let Some(list) = json.get("data").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(id) = m.get("id").and_then(|v| v.as_str()) {
                            models.push(id.to_string());
                        }
                    }
                }
                Ok(models)
            }
        }
    }

    /// Sends a prompt either via Goose daemon (if active) or directly via streaming LLM client.
    pub async fn send_message(
        &self,
        app_handle: AppHandle,
        payload: SendGooseMessagePayload,
    ) -> Result<(), String> {
        let session_id = payload.session_id.clone();
        let message_id = Uuid::new_v4().to_string();
        let cancel_flag = self.register_cancellation(&session_id);

        let mut cfg = self.get_ai_config();

        // The managed provider is deliberately routed through TheBerry's own
        // local server. It never depends on the separately installed Goose or
        // Ollama daemons configured for the other providers.
        if cfg.active_provider == "local" {
            let Some(model_id) = cfg.local_model_id.clone() else {
                self.clear_cancellation(&session_id);
                return Err(
                    "Choose or download a local GGUF model in AI settings first.".to_string(),
                );
            };
            let runtime = match self.start_local_runtime(&app_handle, &model_id).await {
                Ok(runtime) => runtime,
                Err(error) => {
                    self.clear_cancellation(&session_id);
                    return Err(error);
                }
            };
            cfg.base_url = runtime.base_url.ok_or_else(|| {
                "The local inference server did not report an endpoint.".to_string()
            })?;
            cfg.model = model_id;
            cfg.api_key.clear();
            cfg.request_format = "openai".to_string();
            let result = self
                .send_local_llm_stream(
                    app_handle,
                    payload,
                    cfg,
                    session_id.clone(),
                    message_id,
                    cancel_flag,
                )
                .await;
            self.clear_cancellation(&session_id);
            return result;
        }
        let active_port = self.process_manager.get_active_port().await;

        // Mode 1: If Goose daemon is actively running, route through Goose server
        if let Some(port) = active_port {
            let endpoint = format!("http://127.0.0.1:{}/sessions/{}/messages", port, session_id);
            let request_body = serde_json::json!({
                "prompt": &payload.prompt,
                "model": payload.model.as_ref().unwrap_or(&cfg.model),
                "provider": payload.provider.as_ref().unwrap_or(&cfg.active_provider),
            });

            match self
                .http_client
                .post(&endpoint)
                .header("Accept", "text/event-stream")
                .json(&request_body)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    let res = self
                        .consume_sse_stream(
                            app_handle,
                            response,
                            session_id.clone(),
                            message_id,
                            cancel_flag,
                        )
                        .await;
                    self.clear_cancellation(&session_id);
                    return res;
                }
                _ => {
                    // Fall back to direct LLM execution if Goose server is unreachable
                }
            }
        }

        // Mode 2: Direct Streaming LLM Execution (OpenAI-compatible / Ollama / OpenRouter / DeepSeek / Gemini)
        let res = self
            .send_direct_llm_stream(
                app_handle,
                payload,
                cfg,
                session_id.clone(),
                message_id,
                cancel_flag,
            )
            .await;
        self.clear_cancellation(&session_id);
        res
    }

    async fn send_local_llm_stream(
        &self,
        app_handle: AppHandle,
        _payload: SendGooseMessagePayload,
        cfg: AIConfig,
        session_id: String,
        message_id: String,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let model_id = cfg
            .local_model_id
            .clone()
            .unwrap_or_else(|| cfg.model.clone());
        let endpoint = format!("{}/chat/completions", cfg.base_url.trim_end_matches('/'));
        let tool_support = self.local_manager.tool_support(&model_id)?;
        let tools_enabled = cfg.enable_developer_tools && tool_support == "verified";
        let tools = serde_json::json!([
            {
                "type": "function",
                "function": {
                    "name": "get_current_time",
                    "description": "Return the current local date and time in ISO 8601 format.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "additionalProperties": false
                    }
                }
            }
        ]);
        let mut messages = vec![
            serde_json::json!({ "role": "system", "content": cfg.system_prompt }),
            serde_json::json!({ "role": "user", "content": "" }),
        ];
        if let Some(user) = messages.get_mut(1) {
            user["content"] = serde_json::Value::String(_payload.prompt);
        }

        for round in 0..=2 {
            if cancel_flag.load(Ordering::Relaxed) {
                self.emit_local_finished(
                    &app_handle,
                    &session_id,
                    &message_id,
                    "",
                    Some("AI response stopped by user."),
                );
                return Ok(());
            }
            let mut body = serde_json::json!({
                "model": model_id,
                "messages": messages,
                "temperature": cfg.temperature,
                "max_tokens": cfg.max_tokens,
                "stream": true
            });
            if tools_enabled {
                body["tools"] = tools.clone();
                body["tool_choice"] = serde_json::json!("auto");
            }

            let response = match self
                .http_client
                .post(&endpoint)
                .header("Accept", "text/event-stream, application/json")
                .json(&body)
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    let message = format!("Could not connect to the managed local model: {error}");
                    self.emit_local_finished(
                        &app_handle,
                        &session_id,
                        &message_id,
                        "",
                        Some(&message),
                    );
                    return Err(message);
                }
            };
            if !response.status().is_success() {
                let status = response.status();
                let details = response.text().await.unwrap_or_default();
                let message = format!("Local inference server returned HTTP {status}: {details}");
                self.emit_local_finished(&app_handle, &session_id, &message_id, "", Some(&message));
                return Err(message);
            }

            let (assistant_text, tool_calls) = self
                .consume_local_openai_stream(
                    app_handle.clone(),
                    response,
                    session_id.clone(),
                    message_id.clone(),
                    cancel_flag.clone(),
                )
                .await?;
            if cancel_flag.load(Ordering::Relaxed) {
                return Ok(());
            }
            if tool_calls.is_empty() {
                self.emit_local_finished(&app_handle, &session_id, &message_id, "", None);
                return Ok(());
            }
            if !tools_enabled || round == 2 {
                self.emit_local_finished(
                    &app_handle,
                    &session_id,
                    &message_id,
                    "I reached the local tool-call limit for this response.",
                    None,
                );
                return Ok(());
            }

            let mut assistant_message = serde_json::json!({
                "role": "assistant",
                "content": if assistant_text.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(assistant_text) },
                "tool_calls": tool_calls
            });
            if !assistant_message["tool_calls"].is_array() {
                assistant_message["tool_calls"] = serde_json::Value::Array(Vec::new());
            }
            messages.push(assistant_message.clone());
            if let Some(calls) = assistant_message["tool_calls"].as_array() {
                for call in calls {
                    let call_id = call
                        .get("id")
                        .and_then(|value| value.as_str())
                        .unwrap_or("local-tool-call");
                    let function = call.get("function").cloned().unwrap_or_default();
                    let tool_name = function
                        .get("name")
                        .and_then(|value| value.as_str())
                        .unwrap_or("");
                    let args_text = function
                        .get("arguments")
                        .and_then(|value| value.as_str())
                        .unwrap_or("{}");
                    let tool_result = match tool_name {
                        "get_current_time" => {
                            serde_json::json!({ "now": chrono::Local::now().to_rfc3339() })
                        }
                        _ => {
                            serde_json::json!({ "error": format!("Tool '{tool_name}' is not available in TheBerry's local provider.") })
                        }
                    };
                    let _ = serde_json::from_str::<serde_json::Value>(args_text);
                    messages.push(serde_json::json!({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": tool_result.to_string()
                    }));
                }
            }
        }
        Ok(())
    }

    async fn consume_local_openai_stream(
        &self,
        app_handle: AppHandle,
        response: reqwest::Response,
        session_id: String,
        message_id: String,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<(String, Vec<serde_json::Value>), String> {
        let mut stream = response.bytes_stream();
        let mut bytes = Vec::new();
        let mut assistant_text = String::new();
        let mut tool_calls: BTreeMap<usize, LocalToolCallDelta> = BTreeMap::new();
        loop {
            if cancel_flag.load(Ordering::Relaxed) {
                self.emit_local_finished(
                    &app_handle,
                    &session_id,
                    &message_id,
                    "",
                    Some("AI response stopped by user."),
                );
                return Ok((assistant_text, Vec::new()));
            }
            let next = match tokio::time::timeout(Duration::from_secs(60), stream.next()).await {
                Ok(next) => next,
                Err(_) => {
                    let message = "AI generation timed out (no data received for 60 seconds).";
                    self.emit_local_finished(
                        &app_handle,
                        &session_id,
                        &message_id,
                        "",
                        Some(message),
                    );
                    return Err(message.to_string());
                }
            };
            let Some(next) = next else { break };
            let chunk = next.map_err(|error| format!("Local response stream failed: {error}"))?;
            bytes.extend_from_slice(&chunk);
            while let Some(newline) = bytes.iter().position(|byte| *byte == b'\n') {
                let line = String::from_utf8_lossy(&bytes[..newline])
                    .trim()
                    .to_string();
                bytes.drain(..=newline);
                let data = line.strip_prefix("data:").map(str::trim).unwrap_or(&line);
                if data.is_empty() || data == "[DONE]" {
                    if data == "[DONE]" {
                        let calls = tool_calls
                            .into_values()
                            .map(|call| call.as_json())
                            .collect();
                        return Ok((assistant_text, calls));
                    }
                    continue;
                }
                let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
                    continue;
                };
                let Some(delta) = json.pointer("/choices/0/delta") else {
                    continue;
                };
                if let Some(text) = delta.get("content").and_then(|value| value.as_str()) {
                    assistant_text.push_str(text);
                    if !text.is_empty() {
                        let _ = app_handle.emit(
                            "goose://stream-chunk",
                            GooseStreamChunk {
                                session_id: session_id.clone(),
                                message_id: message_id.clone(),
                                delta: text.to_string(),
                                is_finished: false,
                                error: None,
                            },
                        );
                    }
                }
                if let Some(deltas) = delta.get("tool_calls").and_then(|value| value.as_array()) {
                    for call in deltas {
                        let index = call
                            .get("index")
                            .and_then(|value| value.as_u64())
                            .unwrap_or(0) as usize;
                        let entry = tool_calls.entry(index).or_default();
                        if let Some(id) = call.get("id").and_then(|value| value.as_str()) {
                            entry.id.push_str(id);
                        }
                        if let Some(name) = call
                            .pointer("/function/name")
                            .and_then(|value| value.as_str())
                        {
                            entry.name.push_str(name);
                        }
                        if let Some(arguments) = call
                            .pointer("/function/arguments")
                            .and_then(|value| value.as_str())
                        {
                            entry.arguments.push_str(arguments);
                        }
                    }
                }
            }
        }
        if !bytes.is_empty() {
            let line = String::from_utf8_lossy(&bytes).trim().to_string();
            let data = line.strip_prefix("data:").map(str::trim).unwrap_or(&line);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(text) = json
                    .pointer("/choices/0/delta/content")
                    .and_then(|value| value.as_str())
                {
                    assistant_text.push_str(text);
                    if !text.is_empty() {
                        let _ = app_handle.emit(
                            "goose://stream-chunk",
                            GooseStreamChunk {
                                session_id: session_id.clone(),
                                message_id: message_id.clone(),
                                delta: text.to_string(),
                                is_finished: false,
                                error: None,
                            },
                        );
                    }
                }
            }
        }
        Ok((
            assistant_text,
            tool_calls
                .into_values()
                .map(|call| call.as_json())
                .collect(),
        ))
    }

    fn emit_local_finished(
        &self,
        app_handle: &AppHandle,
        session_id: &str,
        message_id: &str,
        delta: &str,
        error: Option<&str>,
    ) {
        let _ = app_handle.emit(
            "goose://stream-chunk",
            GooseStreamChunk {
                session_id: session_id.to_string(),
                message_id: message_id.to_string(),
                delta: delta.to_string(),
                is_finished: true,
                error: error.map(str::to_string),
            },
        );
    }

    async fn send_direct_llm_stream(
        &self,
        app_handle: AppHandle,
        payload: SendGooseMessagePayload,
        cfg: AIConfig,
        session_id: String,
        message_id: String,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let format = cfg.request_format.to_lowercase();
        let model = payload.model.unwrap_or_else(|| cfg.model.clone());
        let raw_base = cfg.base_url.trim();

        // If using local Ollama model, ensure Ollama daemon is running in background
        if (format == "ollama" || cfg.active_provider == "ollama" || raw_base.contains("11434"))
            && cfg.auto_start_ollama
        {
            let _ = self.ensure_ollama_running().await;
        }

        // 1. Smart Endpoint & Protocol Resolution
        let (endpoint, req_body, is_anthropic, is_gemini) = match format.as_str() {
            "anthropic" => {
                let url = if raw_base.is_empty() {
                    "https://api.anthropic.com/v1/messages".to_string()
                } else if raw_base.ends_with("/messages") {
                    raw_base.to_string()
                } else {
                    format!("{}/messages", raw_base.trim_end_matches('/'))
                };

                let body = serde_json::json!({
                    "model": model,
                    "system": cfg.system_prompt,
                    "messages": [
                        { "role": "user", "content": payload.prompt }
                    ],
                    "max_tokens": cfg.max_tokens,
                    "temperature": cfg.temperature,
                    "stream": true
                });

                (url, body, true, false)
            }
            "gemini" => {
                let full_prompt = if cfg.system_prompt.is_empty() {
                    payload.prompt.clone()
                } else {
                    format!("{}\n\n{}", cfg.system_prompt, payload.prompt)
                };

                let clean_model = model.trim_start_matches("models/").trim();
                let url = if raw_base.is_empty() {
                    format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent", clean_model)
                } else if raw_base.contains(":generateContent")
                    || raw_base.contains(":streamGenerateContent")
                {
                    raw_base.to_string()
                } else if raw_base.contains("/models/") {
                    format!("{}:generateContent", raw_base.trim_end_matches('/'))
                } else {
                    format!(
                        "{}/models/{}:generateContent",
                        raw_base.trim_end_matches('/'),
                        clean_model
                    )
                };

                let body = serde_json::json!({
                    "contents": [
                        {
                            "parts": [
                                { "text": full_prompt }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": cfg.temperature,
                        "maxOutputTokens": cfg.max_tokens
                    }
                });

                (url, body, false, true)
            }
            "ollama" => {
                let url = if raw_base.is_empty() {
                    "http://localhost:11434/api/chat".to_string()
                } else if raw_base.ends_with("/api/chat") || raw_base.ends_with("/chat/completions")
                {
                    raw_base.to_string()
                } else if raw_base.ends_with("/v1") {
                    format!("{}/chat/completions", raw_base.trim_end_matches('/'))
                } else {
                    format!("{}/api/chat", raw_base.trim_end_matches('/'))
                };

                let body = serde_json::json!({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": cfg.system_prompt },
                        { "role": "user", "content": payload.prompt }
                    ],
                    "stream": true
                });

                (url, body, false, false)
            }
            "custom" => {
                // Exact raw URL with standard OpenAI payload
                let url = raw_base.to_string();
                let body = serde_json::json!({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": cfg.system_prompt },
                        { "role": "user", "content": payload.prompt }
                    ],
                    "temperature": cfg.temperature,
                    "max_tokens": cfg.max_tokens,
                    "stream": true
                });

                (url, body, false, false)
            }
            _ => {
                // Default: OpenAI / OpenAI-Compatible
                let url = if raw_base.is_empty() {
                    match cfg.active_provider.as_str() {
                        "deepseek" => "https://api.deepseek.com/v1/chat/completions".to_string(),
                        "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
                        "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
                        "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions".to_string(),
                        "ollama" => "http://localhost:11434/v1/chat/completions".to_string(),
                        _ => "https://api.openai.com/v1/chat/completions".to_string(),
                    }
                } else if raw_base.ends_with("/chat/completions") {
                    raw_base.to_string()
                } else {
                    format!("{}/chat/completions", raw_base.trim_end_matches('/'))
                };

                let body = serde_json::json!({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": cfg.system_prompt },
                        { "role": "user", "content": payload.prompt }
                    ],
                    "temperature": cfg.temperature,
                    "max_tokens": cfg.max_tokens,
                    "stream": true
                });

                (url, body, false, false)
            }
        };

        // 2. Build Request with proper headers
        let mut req = self
            .http_client
            .post(&endpoint)
            .header("Accept", "text/event-stream, application/json")
            .header("Content-Type", "application/json");

        if !cfg.api_key.trim().is_empty() {
            if is_anthropic {
                req = req
                    .header("x-api-key", cfg.api_key.trim())
                    .header("anthropic-version", "2023-06-01");
            } else if is_gemini {
                req = req.header("X-goog-api-key", cfg.api_key.trim());
            } else {
                req = req.header("Authorization", format!("Bearer {}", cfg.api_key.trim()));
            }
        }

        let response = match req.json(&req_body).send().await {
            Ok(res) => res,
            Err(e) => {
                let error_chunk = GooseStreamChunk {
                    session_id: session_id.clone(),
                    message_id: message_id.clone(),
                    delta: String::new(),
                    is_finished: true,
                    error: Some(format!(
                        "Connection failed to endpoint [{}]: {}. Please check your URL and network in Settings.",
                        endpoint, e
                    )),
                };
                let _ = app_handle.emit("goose://stream-chunk", error_chunk);
                return Err(format!("Connection error: {}", e));
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let err_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_chunk = GooseStreamChunk {
                session_id: session_id.clone(),
                message_id: message_id.clone(),
                delta: String::new(),
                is_finished: true,
                error: Some(format!(
                    "HTTP {} from {}: {}",
                    status_code, endpoint, err_text
                )),
            };
            let _ = app_handle.emit("goose://stream-chunk", error_chunk);
            return Err(format!("HTTP Error {}: {}", status_code, err_text));
        }

        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        let is_stream_request = req_body
            .get("stream")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let is_stream_response = content_type.contains("text/event-stream")
            || content_type.contains("application/x-ndjson")
            || content_type.contains("application/jsonl")
            || format == "ollama"
            || is_stream_request;

        if is_stream_response {
            self.consume_sse_stream(app_handle, response, session_id, message_id, cancel_flag)
                .await
        } else {
            // Check cancellation before emitting single response
            if cancel_flag.load(Ordering::Relaxed) {
                let cancel_chunk = GooseStreamChunk {
                    session_id,
                    message_id,
                    delta: String::new(),
                    is_finished: true,
                    error: Some("AI generation stopped by user.".to_string()),
                };
                let _ = app_handle.emit("goose://stream-chunk", cancel_chunk);
                return Ok(());
            }

            // Whole JSON or text REST response (e.g. Gemini :generateContent or non-streaming endpoints)
            let text = response.text().await.unwrap_or_default();
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                let delta = Self::extract_text_from_value(&json).unwrap_or_default();
                let stream_chunk = GooseStreamChunk {
                    session_id,
                    message_id,
                    delta,
                    is_finished: true,
                    error: None,
                };
                let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
            } else if !text.trim().is_empty() {
                let stream_chunk = GooseStreamChunk {
                    session_id,
                    message_id,
                    delta: text.trim().to_string(),
                    is_finished: true,
                    error: None,
                };
                let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
            } else {
                let stream_chunk = GooseStreamChunk {
                    session_id,
                    message_id,
                    delta: String::new(),
                    is_finished: true,
                    error: None,
                };
                let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
            }
            Ok(())
        }
    }

    async fn consume_sse_stream(
        &self,
        app_handle: AppHandle,
        response: reqwest::Response,
        session_id: String,
        message_id: String,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        loop {
            // 1. Check if user cancelled
            if cancel_flag.load(Ordering::Relaxed) {
                let stop_chunk = GooseStreamChunk {
                    session_id: session_id.clone(),
                    message_id: message_id.clone(),
                    delta: String::new(),
                    is_finished: true,
                    error: Some("AI response stopped by user.".to_string()),
                };
                let _ = app_handle.emit("goose://stream-chunk", stop_chunk);
                return Ok(());
            }

            // 2. Read next chunk with a 60-second idle timeout
            let chunk_opt =
                match tokio::time::timeout(std::time::Duration::from_secs(60), stream.next()).await
                {
                    Ok(Some(chunk)) => chunk,
                    Ok(None) => break, // End of stream
                    Err(_) => {
                        let timeout_chunk = GooseStreamChunk {
                            session_id: session_id.clone(),
                            message_id: message_id.clone(),
                            delta: String::new(),
                            is_finished: true,
                            error: Some(
                                "AI generation timed out (no data received for 60 seconds)."
                                    .to_string(),
                            ),
                        };
                        let _ = app_handle.emit("goose://stream-chunk", timeout_chunk);
                        return Err("Stream read timed out".to_string());
                    }
                };

            match chunk_opt {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        buffer.push_str(text);

                        while let Some(newline_pos) = buffer.find('\n') {
                            let raw_line = buffer[..newline_pos].trim().to_string();
                            buffer = buffer[newline_pos + 1..].to_string();

                            if raw_line.is_empty() {
                                continue;
                            }

                            // Handle raw SSE (data: ...) or raw NDJSON lines ({"message":...})
                            let data_str = if raw_line.starts_with("data:") {
                                raw_line.trim_start_matches("data:").trim()
                            } else {
                                &raw_line
                            };

                            if data_str == "[DONE]" {
                                let end_chunk = GooseStreamChunk {
                                    session_id: session_id.clone(),
                                    message_id: message_id.clone(),
                                    delta: String::new(),
                                    is_finished: true,
                                    error: None,
                                };
                                let _ = app_handle.emit("goose://stream-chunk", end_chunk);
                                return Ok(());
                            }

                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data_str) {
                                let is_done =
                                    json.get("done").and_then(|v| v.as_bool()).unwrap_or(false);

                                if let Some(delta) = Self::extract_text_from_value(&json) {
                                    if !delta.is_empty() {
                                        let stream_chunk = GooseStreamChunk {
                                            session_id: session_id.clone(),
                                            message_id: message_id.clone(),
                                            delta,
                                            is_finished: false,
                                            error: None,
                                        };
                                        let _ =
                                            app_handle.emit("goose://stream-chunk", stream_chunk);
                                    }
                                }

                                if is_done {
                                    let end_chunk = GooseStreamChunk {
                                        session_id: session_id.clone(),
                                        message_id: message_id.clone(),
                                        delta: String::new(),
                                        is_finished: true,
                                        error: None,
                                    };
                                    let _ = app_handle.emit("goose://stream-chunk", end_chunk);
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    let err_chunk = GooseStreamChunk {
                        session_id: session_id.clone(),
                        message_id: message_id.clone(),
                        delta: String::new(),
                        is_finished: true,
                        error: Some(format!("Stream read error: {}", e)),
                    };
                    let _ = app_handle.emit("goose://stream-chunk", err_chunk);
                    return Err(format!("Stream error: {}", e));
                }
            }
        }

        // Process any remaining bytes in buffer
        let remaining = buffer.trim();
        if !remaining.is_empty() {
            let data_str = if remaining.starts_with("data:") {
                remaining.trim_start_matches("data:").trim()
            } else {
                remaining
            };

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data_str) {
                if let Some(delta) = Self::extract_text_from_value(&json) {
                    if !delta.is_empty() {
                        let stream_chunk = GooseStreamChunk {
                            session_id: session_id.clone(),
                            message_id: message_id.clone(),
                            delta,
                            is_finished: false,
                            error: None,
                        };
                        let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
                    }
                }
            }
        }

        // Final completion event
        let final_chunk = GooseStreamChunk {
            session_id,
            message_id,
            delta: String::new(),
            is_finished: true,
            error: None,
        };
        let _ = app_handle.emit("goose://stream-chunk", final_chunk);

        Ok(())
    }

    /// Recursively and robustly extracts text content from various LLM response formats
    fn extract_text_from_value(val: &serde_json::Value) -> Option<String> {
        // 1. Array of objects (e.g. Gemini batch response or candidate array)
        if let Some(arr) = val.as_array() {
            let mut combined = String::new();
            for item in arr {
                if let Some(t) = Self::extract_text_from_value(item) {
                    combined.push_str(&t);
                }
            }
            if !combined.is_empty() {
                return Some(combined);
            }
        }

        // 2. OpenAI / OneAPI / DeepSeek / Groq: choices[0].delta.content or choices[0].message.content
        if let Some(c) = val
            .pointer("/choices/0/delta/content")
            .and_then(|v| v.as_str())
        {
            return Some(c.to_string());
        }
        if let Some(c) = val
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
        {
            return Some(c.to_string());
        }

        // 3. Anthropic Claude: delta.text or content_block.text
        if let Some(t) = val.pointer("/delta/text").and_then(|v| v.as_str()) {
            return Some(t.to_string());
        }
        if let Some(t) = val.pointer("/content_block/text").and_then(|v| v.as_str()) {
            return Some(t.to_string());
        }

        // 4. Google Gemini: candidates[0].content.parts[0].text (extract from all candidates & parts)
        if let Some(candidates) = val.get("candidates").and_then(|v| v.as_array()) {
            let mut text = String::new();
            for cand in candidates {
                if let Some(parts) = cand.pointer("/content/parts").and_then(|v| v.as_array()) {
                    for part in parts {
                        if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                            text.push_str(t);
                        }
                    }
                }
            }
            if !text.is_empty() {
                return Some(text);
            }
        }

        // 5. Ollama: message.content or response
        if let Some(c) = val.pointer("/message/content").and_then(|v| v.as_str()) {
            return Some(c.to_string());
        }
        if let Some(c) = val.get("response").and_then(|v| v.as_str()) {
            return Some(c.to_string());
        }

        // 6. Direct common text fields
        if let Some(t) = val.get("text").and_then(|v| v.as_str()) {
            return Some(t.to_string());
        }
        if let Some(c) = val.get("content").and_then(|v| v.as_str()) {
            return Some(c.to_string());
        }

        None
    }
}

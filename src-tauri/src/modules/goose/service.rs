use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use uuid::Uuid;

use super::process::GooseProcessManager;
use super::types::{AIConfig, GooseStatus, GooseStreamChunk, SendGooseMessagePayload};

pub struct GooseService {
    process_manager: Arc<GooseProcessManager>,
    http_client: reqwest::Client,
    ai_config: RwLock<AIConfig>,
}

impl GooseService {
    pub fn new() -> Self {
        let default_cfg = AIConfig::default();
        let loaded_cfg = Self::load_persisted_config().unwrap_or(default_cfg);

        Self {
            process_manager: Arc::new(GooseProcessManager::new()),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
            ai_config: RwLock::new(loaded_cfg),
        }
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

                let resp = req.send().await.map_err(|e| format!("Gemini API request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Gemini API error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse Gemini response JSON: {}", e))?;
                let mut models = Vec::new();
                if let Some(list) = json.get("models").and_then(|v| v.as_array()) {
                    for m in list {
                        if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                            let clean = name.trim_start_matches("models/").to_string();
                            let supported = m.get("supportedGenerationMethods")
                                .and_then(|v| v.as_array())
                                .map(|arr| arr.iter().any(|method| method.as_str() == Some("generateContent")))
                                .unwrap_or(true);
                            if supported {
                                models.push(clean);
                            }
                        }
                    }
                }
                if models.is_empty() {
                    models = vec![
                        "gemini-2.0-flash".to_string(),
                        "gemini-1.5-flash".to_string(),
                        "gemini-1.5-pro".to_string(),
                        "gemini-flash-latest".to_string(),
                    ];
                }
                Ok(models)
            }
            "ollama" => {
                let url = if base.is_empty() {
                    "http://localhost:11434/api/tags".to_string()
                } else if base.ends_with("/api/tags") || base.ends_with("/v1/models") {
                    base
                } else {
                    format!("{}/api/tags", base.trim_end_matches('/'))
                };

                let resp = self.http_client.get(&url).send().await.map_err(|e| format!("Ollama request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Ollama error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse Ollama JSON: {}", e))?;
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

                let mut req = self.http_client.get(&url).header("anthropic-version", "2023-06-01");
                if !raw_key.is_empty() {
                    req = req.header("x-api-key", &raw_key);
                }

                let resp = req.send().await.map_err(|e| format!("Anthropic request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Anthropic error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse Anthropic JSON: {}", e))?;
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

                let resp = req.send().await.map_err(|e| format!("Models request failed: {}", e))?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Provider API error (HTTP {}): {}", status, err));
                }

                let json: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse JSON: {}", e))?;
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

        let cfg = self.get_ai_config();
        let active_port = self.process_manager.get_active_port().await;

        // Mode 1: If Goose daemon is actively running, route through Goose server
        if let Some(port) = active_port {
            let endpoint = format!("http://127.0.0.1:{}/sessions/{}/messages", port, session_id);
            let request_body = serde_json::json!({
                "prompt": &payload.prompt,
                "model": payload.model.as_ref().unwrap_or(&cfg.model),
                "provider": payload.provider.as_ref().unwrap_or(&cfg.active_provider),
            });

            match self.http_client
                .post(&endpoint)
                .header("Accept", "text/event-stream")
                .json(&request_body)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    return self.consume_sse_stream(app_handle, response, session_id, message_id).await;
                }
                _ => {
                    // Fall back to direct LLM execution if Goose server is unreachable
                }
            }
        }

        // Mode 2: Direct Streaming LLM Execution (OpenAI-compatible / Ollama / OpenRouter / DeepSeek / Gemini)
        self.send_direct_llm_stream(app_handle, payload, cfg, session_id, message_id).await
    }

    async fn send_direct_llm_stream(
        &self,
        app_handle: AppHandle,
        payload: SendGooseMessagePayload,
        cfg: AIConfig,
        session_id: String,
        message_id: String,
    ) -> Result<(), String> {
        let format = cfg.request_format.to_lowercase();
        let model = payload.model.unwrap_or_else(|| cfg.model.clone());
        let raw_base = cfg.base_url.trim();

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
                } else if raw_base.contains(":generateContent") || raw_base.contains(":streamGenerateContent") {
                    raw_base.to_string()
                } else if raw_base.contains("/models/") {
                    format!("{}:generateContent", raw_base.trim_end_matches('/'))
                } else {
                    format!("{}/models/{}:generateContent", raw_base.trim_end_matches('/'), clean_model)
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
                } else if raw_base.ends_with("/api/chat") || raw_base.ends_with("/chat/completions") {
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
        let mut req = self.http_client
            .post(&endpoint)
            .header("Accept", "text/event-stream, application/json")
            .header("Content-Type", "application/json");

        if !cfg.api_key.trim().is_empty() {
            if is_anthropic {
                req = req.header("x-api-key", cfg.api_key.trim())
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
            let err_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            let error_chunk = GooseStreamChunk {
                session_id: session_id.clone(),
                message_id: message_id.clone(),
                delta: String::new(),
                is_finished: true,
                error: Some(format!("HTTP {} from {}: {}", status_code, endpoint, err_text)),
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

        let is_stream_request = req_body.get("stream").and_then(|v| v.as_bool()).unwrap_or(false);
        let is_stream_response = content_type.contains("text/event-stream")
            || content_type.contains("application/x-ndjson")
            || content_type.contains("application/jsonl")
            || format == "ollama"
            || is_stream_request;

        if is_stream_response {
            self.consume_sse_stream(app_handle, response, session_id, message_id).await
        } else {
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
    ) -> Result<(), String> {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
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
                                let is_done = json.get("done").and_then(|v| v.as_bool()).unwrap_or(false);

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
        if let Some(c) = val.pointer("/choices/0/delta/content").and_then(|v| v.as_str()) {
            return Some(c.to_string());
        }
        if let Some(c) = val.pointer("/choices/0/message/content").and_then(|v| v.as_str()) {
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


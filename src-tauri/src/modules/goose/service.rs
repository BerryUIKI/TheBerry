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
        if path.exists() {
            let data = std::fs::read_to_string(path).ok()?;
            serde_json::from_str(&data).ok()
        } else {
            None
        }
    }

    pub fn get_ai_config(&self) -> AIConfig {
        self.ai_config.read().unwrap().clone()
    }

    pub fn save_ai_config(&self, config: AIConfig) -> Result<(), String> {
        if let Some(path) = Self::get_config_path() {
            let data = serde_json::to_string_pretty(&config)
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
                let url = if raw_base.is_empty() {
                    format!("https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}", model, cfg.api_key.trim())
                } else if raw_base.contains("streamGenerateContent") {
                    raw_base.to_string()
                } else {
                    format!("{}/models/{}:streamGenerateContent?key={}", raw_base.trim_end_matches('/'), model, cfg.api_key.trim())
                };

                let full_prompt = if cfg.system_prompt.is_empty() {
                    payload.prompt.clone()
                } else {
                    format!("{}\n\n{}", cfg.system_prompt, payload.prompt)
                };

                let body = serde_json::json!({
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{ "text": full_prompt }]
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
            } else if !is_gemini {
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

        self.consume_sse_stream(app_handle, response, session_id, message_id).await
    }

    async fn consume_sse_stream(
        &self,
        app_handle: AppHandle,
        response: reqwest::Response,
        session_id: String,
        message_id: String,
    ) -> Result<(), String> {
        let mut stream = response.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        for line in text.lines() {
                            let line = line.trim();
                            if line.is_empty() {
                                continue;
                            }

                            // Handle raw SSE or NDJSON lines
                            let data_str = if line.starts_with("data:") {
                                line.trim_start_matches("data:").trim()
                            } else {
                                line
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
                                // Multi-protocol delta extractor:
                                // 1. OpenAI / OneAPI / DeepSeek: choices[0].delta.content
                                // 2. Anthropic: delta.text or content_block.text
                                // 3. Gemini: candidates[0].content.parts[0].text
                                // 4. Ollama: message.content or response
                                let delta = json.pointer("/choices/0/delta/content")
                                    .and_then(|v| v.as_str())
                                    .or_else(|| json.pointer("/delta/text").and_then(|v| v.as_str()))
                                    .or_else(|| json.pointer("/content_block/text").and_then(|v| v.as_str()))
                                    .or_else(|| json.pointer("/candidates/0/content/parts/0/text").and_then(|v| v.as_str()))
                                    .or_else(|| json.pointer("/message/content").and_then(|v| v.as_str()))
                                    .or_else(|| json.get("response").and_then(|v| v.as_str()))
                                    .or_else(|| json.get("delta").and_then(|v| v.as_str()))
                                    .or_else(|| json.get("text").and_then(|v| v.as_str()))
                                    .or_else(|| json.get("content").and_then(|v| v.as_str()))
                                    .unwrap_or("");

                                if !delta.is_empty() {
                                    let stream_chunk = GooseStreamChunk {
                                        session_id: session_id.clone(),
                                        message_id: message_id.clone(),
                                        delta: delta.to_string(),
                                        is_finished: false,
                                        error: None,
                                    };
                                    let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
                                }
                            } else if !data_str.is_empty() && !data_str.starts_with("event:") {
                                let stream_chunk = GooseStreamChunk {
                                    session_id: session_id.clone(),
                                    message_id: message_id.clone(),
                                    delta: data_str.to_string(),
                                    is_finished: false,
                                    error: None,
                                };
                                let _ = app_handle.emit("goose://stream-chunk", stream_chunk);
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
}


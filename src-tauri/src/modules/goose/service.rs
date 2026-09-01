use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use uuid::Uuid;

use super::process::GooseProcessManager;
use super::types::{GooseStatus, GooseStreamChunk, SendGooseMessagePayload};

pub struct GooseService {
    process_manager: Arc<GooseProcessManager>,
    http_client: reqwest::Client,
}

impl GooseService {
    pub fn new() -> Self {
        Self {
            process_manager: Arc::new(GooseProcessManager::new()),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn get_process_manager(&self) -> Arc<GooseProcessManager> {
        self.process_manager.clone()
    }

    pub fn get_status(&self) -> GooseStatus {
        self.process_manager.get_status()
    }

    pub async fn start_daemon(&self, custom_port: Option<u16>) -> Result<GooseStatus, String> {
        self.process_manager.start_server(custom_port).await
    }

    pub async fn stop_daemon(&self) -> Result<(), String> {
        self.process_manager.stop_server().await
    }

    /// Sends a prompt to the local Goose server and streams the tokens to the frontend via Tauri events.
    pub async fn send_message(
        &self,
        app_handle: AppHandle,
        payload: SendGooseMessagePayload,
    ) -> Result<(), String> {
        let port = self.process_manager.get_active_port().await;

        let port = match port {
            Some(p) => p,
            None => {
                // If daemon is not running, attempt auto-start
                let status = self.start_daemon(None).await?;
                status.port.ok_or_else(|| "Failed to determine active port for Goose daemon.".to_string())?
            }
        };

        let session_id = payload.session_id.clone();
        let message_id = Uuid::new_v4().to_string();
        let endpoint = format!("http://127.0.0.1:{}/sessions/{}/messages", port, session_id);

        let request_body = serde_json::json!({
            "prompt": payload.prompt,
            "model": payload.model.unwrap_or_else(|| "gpt-4o".to_string()),
            "provider": payload.provider.unwrap_or_else(|| "openai".to_string()),
        });

        let response = match self.http_client
            .post(&endpoint)
            .header("Accept", "text/event-stream")
            .json(&request_body)
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                // Emit error chunk to frontend
                let error_chunk = GooseStreamChunk {
                    session_id: session_id.clone(),
                    message_id: message_id.clone(),
                    delta: String::new(),
                    is_finished: true,
                    error: Some(format!("Failed to connect to Goose server on port {}: {}", port, e)),
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
                error: Some(format!("Goose server responded with status {}: {}", status_code, err_text)),
            };
            let _ = app_handle.emit("goose://stream-chunk", error_chunk);
            return Err(format!("HTTP Error {}: {}", status_code, err_text));
        }

        // Stream SSE response tokens
        let mut stream = response.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        for line in text.lines() {
                            let line = line.trim();
                            if line.starts_with("data:") {
                                let data_str = line.trim_start_matches("data:").trim();
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
                                    let delta = json.get("delta")
                                        .and_then(|v| v.as_str())
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
                                } else if !data_str.is_empty() {
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

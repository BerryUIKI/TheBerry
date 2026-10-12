export interface GooseStatus {
  is_running: boolean;
  is_installed: boolean;
  binary_path: string | null;
  port: number | null;
  active_model: string | null;
  active_provider: string | null;
  error_message: string | null;
}

export interface SendGooseMessagePayload {
  session_id: string;
  prompt: string;
  model?: string;
  provider?: string;
}

export interface GooseStreamChunk {
  session_id: string;
  message_id: string;
  delta: string;
  is_finished: boolean;
  error?: string | null;
}

export interface GooseChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  error?: string | null;
}

export interface CustomMcpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
}

export type AIRequestFormat = "openai" | "anthropic" | "gemini" | "ollama" | "custom";

export interface AIConfig {
  active_provider: "openai" | "anthropic" | "gemini" | "ollama" | "local" | "deepseek" | "groq" | "openrouter" | "custom";
  request_format: AIRequestFormat;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  language: "en" | "zh";
  user_name: string;
  user_avatar: string;
  enable_developer_tools: boolean;
  enable_web_fetch: boolean;
  custom_mcp_servers: CustomMcpServer[];
  goose_binary_path: string;
  auto_start_daemon: boolean;
  auto_start_ollama?: boolean;
  ollama_binary_path?: string;
  local_model_id?: string | null;
}

export interface OllamaStatus {
  is_running: boolean;
  is_installed: boolean;
  binary_path: string | null;
  port: number;
  models: string[];
  error_message: string | null;
}

export interface LocalModel {
  id: string;
  name: string;
  size_bytes: number;
  source: string;
  revision: string;
  source_url: string;
  license: string;
  hardware_requirements: string;
  tool_support: "verified" | "unverified" | "unsupported" | string;
  sha256: string;
  model_path: string | null;
  is_installed: boolean;
  is_recommended: boolean;
}

export interface LocalRuntimeStatus {
  is_running: boolean;
  backend: "cuda" | "vulkan" | "cpu" | null;
  port: number | null;
  model_id: string | null;
  base_url: string | null;
  error: string | null;
}

export interface LocalModelDownloadProgress {
  model_id: string;
  downloaded_bytes: number;
  total_bytes: number | null;
  is_complete: boolean;
  is_cancelled: boolean;
  error: string | null;
}




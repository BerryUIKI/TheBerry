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
  active_provider: "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "groq" | "openrouter" | "custom";
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
}



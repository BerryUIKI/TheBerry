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

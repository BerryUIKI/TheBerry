import { safeInvoke } from "./tauri";
import { GooseStatus, GooseStreamChunk, SendGooseMessagePayload } from "../types/goose";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function getGooseStatus(): Promise<GooseStatus> {
  return safeInvoke<GooseStatus>("get_goose_status");
}

export async function startGooseDaemon(customPort?: number | null): Promise<GooseStatus> {
  return safeInvoke<GooseStatus>("start_goose_daemon", { customPort: customPort || null });
}

export async function stopGooseDaemon(): Promise<void> {
  return safeInvoke<void>("stop_goose_daemon");
}

export async function sendGooseMessage(payload: SendGooseMessagePayload): Promise<void> {
  return safeInvoke<void>("send_goose_message", { payload });
}

export async function setGooseCustomBinaryPath(path: string | null): Promise<GooseStatus> {
  return safeInvoke<GooseStatus>("set_goose_custom_binary_path", { path: path || null });
}

export async function onGooseStreamChunk(callback: (chunk: GooseStreamChunk) => void): Promise<UnlistenFn> {
  return listen<GooseStreamChunk>("goose://stream-chunk", (event) => {
    callback(event.payload);
  });
}

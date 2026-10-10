import { safeInvoke } from "./tauri";
import { GooseStatus, GooseStreamChunk, SendGooseMessagePayload, LocalModel, LocalRuntimeStatus, LocalModelDownloadProgress } from "../types/goose";
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

export async function abortGooseMessage(sessionId: string): Promise<boolean> {
  return safeInvoke<boolean>("abort_goose_message", { sessionId });
}

export async function setGooseCustomBinaryPath(path: string | null): Promise<GooseStatus> {
  return safeInvoke<GooseStatus>("set_goose_custom_binary_path", { path: path || null });
}

export async function onGooseStreamChunk(callback: (chunk: GooseStreamChunk) => void): Promise<UnlistenFn> {
  return listen<GooseStreamChunk>("goose://stream-chunk", (event) => {
    callback(event.payload);
  });
}

export async function getAIConfig(): Promise<import("../types/goose").AIConfig> {
  return safeInvoke<import("../types/goose").AIConfig>("get_ai_config");
}

export async function saveAIConfig(config: import("../types/goose").AIConfig): Promise<void> {
  return safeInvoke<void>("save_ai_config", { config });
}

export async function fetchProviderModels(
  provider: string,
  baseUrl?: string,
  apiKey?: string,
  requestFormat?: string
): Promise<string[]> {
  return safeInvoke<string[]>("fetch_provider_models", {
    provider,
    baseUrl: baseUrl || null,
    apiKey: apiKey || null,
    requestFormat: requestFormat || null,
  });
}

export async function getOllamaStatus(): Promise<import("../types/goose").OllamaStatus> {
  return safeInvoke<import("../types/goose").OllamaStatus>("get_ollama_status");
}

export async function startOllamaDaemon(): Promise<import("../types/goose").OllamaStatus> {
  return safeInvoke<import("../types/goose").OllamaStatus>("start_ollama_daemon");
}

export async function stopOllamaDaemon(): Promise<void> {
  return safeInvoke<void>("stop_ollama_daemon");
}

export async function listLocalModels(): Promise<LocalModel[]> {
  return safeInvoke<LocalModel[]>("list_local_models");
}

export async function getLocalRuntimeStatus(): Promise<LocalRuntimeStatus> {
  return safeInvoke<LocalRuntimeStatus>("get_local_runtime_status");
}

export async function startLocalRuntime(modelId: string): Promise<LocalRuntimeStatus> {
  return safeInvoke<LocalRuntimeStatus>("start_local_runtime", { modelId });
}

export async function stopLocalRuntime(): Promise<void> {
  return safeInvoke<void>("stop_local_runtime");
}

export async function downloadLocalModel(modelId: string): Promise<void> {
  return safeInvoke<void>("download_local_model", { modelId });
}

export async function cancelLocalModelDownload(modelId: string): Promise<boolean> {
  return safeInvoke<boolean>("cancel_local_model_download", { modelId });
}

export async function importLocalModel(path: string): Promise<LocalModel> {
  return safeInvoke<LocalModel>("import_local_model", { path });
}

export async function removeLocalModel(modelId: string): Promise<void> {
  return safeInvoke<void>("remove_local_model", { modelId });
}

export async function onLocalModelDownloadProgress(
  callback: (progress: LocalModelDownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<LocalModelDownloadProgress>("goose://local-model-download", (event) => callback(event.payload));
}



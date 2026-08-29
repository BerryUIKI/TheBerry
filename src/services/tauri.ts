import { invoke } from "@tauri-apps/api/core";

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err: unknown) {
    console.error(`[IPC Error] ${cmd}:`, err);
    throw typeof err === "string" ? new Error(err) : err;
  }
}

import { invoke } from "@tauri-apps/api/core";

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err: unknown) {
    console.error(`[IPC Error] ${cmd}:`, err);
    if (err instanceof Error) {
      throw err;
    }
    if (typeof err === "string") {
      throw new Error(err);
    }
    if (err && typeof err === "object" && "message" in err) {
      throw new Error(String((err as any).message));
    }
    throw new Error(err ? String(err) : `IPC command '${cmd}' failed`);
  }
}

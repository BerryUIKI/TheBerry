import { safeInvoke } from "./tauri";

export async function isAutostartEnabled(): Promise<boolean> {
  return safeInvoke<boolean>("is_autostart_enabled");
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  return safeInvoke<boolean>("set_autostart", { enabled });
}

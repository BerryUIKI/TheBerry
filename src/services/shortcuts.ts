import { safeInvoke } from "./tauri";

export async function setGlobalShortcutsEnabled(enabled: boolean): Promise<void> {
  return safeInvoke<void>("set_global_shortcuts_enabled", { enabled });
}

export async function setHudShortcut(shortcut: string): Promise<void> {
  return safeInvoke<void>("set_hud_shortcut", { shortcut });
}

export async function toggleHudWindow(show?: boolean): Promise<boolean> {
  return safeInvoke<boolean>("toggle_hud_window", { show: show ?? null });
}

export async function resizeHudWindow(height: number): Promise<void> {
  return safeInvoke<void>("resize_hud_window", { height });
}

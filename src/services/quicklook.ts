import { safeInvoke } from "./tauri";
import { QuickLookPreviewPayload, QuickLookStatus } from "../types/quicklook";

export async function getQuickLookStatus(): Promise<QuickLookStatus> {
  return safeInvoke<QuickLookStatus>("get_quicklook_status");
}

export async function previewWithQuickLook(path: string, mode: "toggle" | "switch" | "preview" = "toggle"): Promise<boolean> {
  if (!path) return false;
  const payload: QuickLookPreviewPayload = { path, mode };
  return safeInvoke<boolean>("quicklook_preview", { payload });
}

export async function closeQuickLook(): Promise<void> {
  return safeInvoke<void>("quicklook_close");
}

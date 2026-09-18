import { safeInvoke } from "./tauri";
import { listen } from "@tauri-apps/api/event";
import { FilePreviewInfo, QuickLookPreviewPayload, QuickLookStatus } from "../types/quicklook";

export async function getQuickLookStatus(): Promise<QuickLookStatus> {
  return safeInvoke<QuickLookStatus>("get_quicklook_status");
}

export async function setQuickLookEnabled(enabled: boolean): Promise<QuickLookStatus> {
  return safeInvoke<QuickLookStatus>("set_quicklook_enabled", { enabled });
}

export async function startQuickLook(): Promise<QuickLookStatus> {
  return safeInvoke<QuickLookStatus>("start_quicklook");
}

export async function stopQuickLook(): Promise<QuickLookStatus> {
  return safeInvoke<QuickLookStatus>("stop_quicklook");
}

export async function onQuickLookStatusChanged(
  callback: (status: QuickLookStatus) => void
): Promise<() => void> {
  return listen<QuickLookStatus>("quicklook-status-changed", (event) => {
    callback(event.payload);
  });
}

export async function getFilePreviewInfo(path: string): Promise<FilePreviewInfo> {
  return safeInvoke<FilePreviewInfo>("get_quicklook_file_preview", { path });
}

export async function previewWithQuickLook(
  path: string,
  mode: "toggle" | "switch" | "preview" = "toggle"
): Promise<boolean> {
  if (!path) return false;

  try {
    const status = await getQuickLookStatus();
    // If user explicitly disabled QuickLook in settings or tray, do not preview
    if (!status.is_enabled) {
      return false;
    }

    // Try embedded/external QuickLook first
    const payload: QuickLookPreviewPayload = { path, mode };
    const ok = await safeInvoke<boolean>("quicklook_preview", { payload });
    if (ok) return true;
  } catch (err) {
    console.warn("External/Embedded QuickLook process invocation failed, falling back to built-in previewer:", err);
  }

  // Seamless fallback to Built-in Native QuickLook Modal
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-quicklook-modal", { detail: { path } }));
  }
  return true;
}

export async function triggerBuiltinPreview(path: string): Promise<void> {
  if (!path) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-quicklook-modal", { detail: { path } }));
  }
}

export async function closeQuickLook(): Promise<void> {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("close-quicklook-modal"));
  }
  try {
    await safeInvoke<void>("quicklook_close");
  } catch (e) {
    // Ignore close error if host is not running
  }
}


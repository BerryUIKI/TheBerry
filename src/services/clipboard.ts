import { safeInvoke } from "./tauri";
import { ClipboardItem } from "../types/clipboard";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function getClipboardHistory(): Promise<ClipboardItem[]> {
  return safeInvoke<ClipboardItem[]>("get_clipboard_history");
}

export async function addClipboardItem(content: string, contentType = "text"): Promise<ClipboardItem> {
  return safeInvoke<ClipboardItem>("add_clipboard_item", { content, contentType });
}

export async function toggleClipboardPin(id: string): Promise<ClipboardItem> {
  return safeInvoke<ClipboardItem>("toggle_clipboard_pin", { id });
}

export async function deleteClipboardItem(id: string): Promise<void> {
  return safeInvoke<void>("delete_clipboard_item", { id });
}

export async function clearClipboardHistory(): Promise<number> {
  return safeInvoke<number>("clear_clipboard_history");
}

export async function copyToSystemClipboard(content: string): Promise<void> {
  return safeInvoke<void>("copy_to_system_clipboard", { content });
}

export async function copyImageToSystemClipboard(imagePath: string): Promise<void> {
  return safeInvoke<void>("copy_image_to_system_clipboard", { imagePath });
}

export async function onClipboardUpdated(callback: (item: ClipboardItem) => void): Promise<UnlistenFn> {
  return listen<ClipboardItem>("clipboard-updated", (event) => {
    callback(event.payload);
  });
}

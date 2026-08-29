import { safeInvoke } from "./tauri";
import { ClipboardItem } from "../types/clipboard";

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

import { safeInvoke } from "./tauri";
import { SnippetItem, SnippetPayload } from "../types/snippets";

export async function getSnippets(): Promise<SnippetItem[]> {
  return safeInvoke<SnippetItem[]>("get_snippets");
}

export async function saveSnippet(payload: SnippetPayload): Promise<SnippetItem> {
  return safeInvoke<SnippetItem>("save_snippet", { payload });
}

export async function deleteSnippet(id: string): Promise<void> {
  return safeInvoke<void>("delete_snippet", { id });
}

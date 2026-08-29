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

export async function expandSnippetTemplate(content: string): Promise<string> {
  return safeInvoke<string>("expand_snippet_template", { content });
}

export async function copyExpandedSnippet(content: string): Promise<string> {
  return safeInvoke<string>("copy_expanded_snippet", { content });
}

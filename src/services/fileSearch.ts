import { safeInvoke } from "./tauri";
import { SearchQuery, SearchResultItem } from "../types/fileSearch";

export interface SystemDrive {
  name: string;
  path: string;
}

export async function searchFiles(query: SearchQuery): Promise<SearchResultItem[]> {
  return safeInvoke<SearchResultItem[]>("search_files", { query });
}

export async function getSystemDrives(): Promise<SystemDrive[]> {
  return safeInvoke<SystemDrive[]>("get_system_drives");
}

export async function revealInExplorer(path: string): Promise<void> {
  return safeInvoke<void>("reveal_in_explorer", { path });
}

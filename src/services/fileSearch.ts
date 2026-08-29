import { safeInvoke } from "./tauri";
import { SearchQuery, SearchResultItem, SystemDrive } from "../types/fileSearch";

export async function searchFiles(query: SearchQuery): Promise<SearchResultItem[]> {
  return safeInvoke<SearchResultItem[]>("search_files", { query });
}

export async function getSystemDrives(): Promise<SystemDrive[]> {
  return safeInvoke<SystemDrive[]>("get_system_drives");
}

export async function revealInExplorer(path: string): Promise<void> {
  return safeInvoke<void>("reveal_in_explorer", { path });
}

export async function openFilePath(path: string): Promise<void> {
  return safeInvoke<void>("open_file_path", { path });
}

import { safeInvoke } from "./tauri";
import { SearchQuery, SearchResultItem } from "../types/fileSearch";

export async function searchFiles(query: SearchQuery): Promise<SearchResultItem[]> {
  return safeInvoke<SearchResultItem[]>("search_files", { query });
}

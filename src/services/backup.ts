import { safeInvoke } from "./tauri";

export interface BackupSummary {
  clipboard_count: number;
  snippets_count: number;
  launcher_count: number;
  created_at: string;
}

export async function exportFullBackup(): Promise<string> {
  return safeInvoke<string>("export_full_backup");
}

export async function importFullBackup(jsonContent: string): Promise<BackupSummary> {
  return safeInvoke<BackupSummary>("import_full_backup", { jsonContent });
}

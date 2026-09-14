import { safeInvoke } from "./tauri";

export interface FileChecksums {
  file_path: string;
  file_name: string;
  file_size: number;
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

export interface RenameItem {
  original_path: string;
  new_path: string;
}

export interface BatchRenameResult {
  total: number;
  success_count: number;
  failure_count: number;
  errors: string[];
}

export async function calculateFileHash(path: string): Promise<FileChecksums> {
  return safeInvoke<FileChecksums>("calculate_file_hash", { path });
}

export async function batchRenameFiles(items: RenameItem[]): Promise<BatchRenameResult> {
  return safeInvoke<BatchRenameResult>("batch_rename_files", { items });
}

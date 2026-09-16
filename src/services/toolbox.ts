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

export interface CompressTask {
  source_path: string;
  quality: number; // 1-100
  max_width?: number | null;
  max_height?: number | null;
  output_dir?: string | null;
  output_format?: "original" | "webp" | "jpeg" | "png" | null;
}

export interface CompressResult {
  source_path: string;
  output_path: string;
  original_size: number;
  compressed_size: number;
  saved_percentage: number;
  success: boolean;
  error_message?: string | null;
}

export interface OcrResult {
  text: string;
  lines: string[];
  language: string;
  success: boolean;
  error_message?: string | null;
}

export interface WordConvertTask {
  source_path: string;
  output_path?: string | null;
}

export interface WordConvertResult {
  source_path: string;
  output_path: string;
  success: boolean;
  error_message?: string | null;
}

export async function calculateFileHash(path: string): Promise<FileChecksums> {
  return safeInvoke<FileChecksums>("calculate_file_hash", { path });
}

export async function batchRenameFiles(items: RenameItem[]): Promise<BatchRenameResult> {
  return safeInvoke<BatchRenameResult>("batch_rename_files", { items });
}

export async function compressImages(tasks: CompressTask[]): Promise<CompressResult[]> {
  return safeInvoke<CompressResult[]>("compress_images", { tasks });
}

export async function recognizeImageOcr(
  imagePath: string,
  langHint?: string
): Promise<OcrResult> {
  return safeInvoke<OcrResult>("recognize_image_ocr", {
    imagePath,
    langHint: langHint || null,
  });
}

export async function convertWordToPdf(task: WordConvertTask): Promise<WordConvertResult> {
  return safeInvoke<WordConvertResult>("convert_word_to_pdf", { task });
}

use super::compressor::{CompressResult, CompressTask, ImageCompressorService};
use super::hash::{calculate_file_checksums, FileChecksums};
use super::ocr::{execute_windows_ocr, OcrResult};
use super::rename::{execute_batch_rename, BatchRenameResult, RenameItem};
use super::word_converter::{convert_word_to_pdf_single, WordConvertResult, WordConvertTask};

#[tauri::command]
pub async fn calculate_file_hash(path: String) -> Result<FileChecksums, String> {
    tokio::task::spawn_blocking(move || calculate_file_checksums(path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn batch_rename_files(items: Vec<RenameItem>) -> Result<BatchRenameResult, String> {
    tokio::task::spawn_blocking(move || Ok(execute_batch_rename(&items)))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn compress_images(tasks: Vec<CompressTask>) -> Result<Vec<CompressResult>, String> {
    tokio::task::spawn_blocking(move || Ok(ImageCompressorService::compress_batch(&tasks)))
        .await
        .map_err(|e| format!("Image compression failed: {}", e))?
}

#[tauri::command]
pub async fn recognize_image_ocr(
    image_path: String,
    lang_hint: Option<String>,
) -> Result<OcrResult, String> {
    tokio::task::spawn_blocking(move || execute_windows_ocr(&image_path, lang_hint))
        .await
        .map_err(|e| format!("OCR execution failed: {}", e))?
}

#[tauri::command]
pub async fn convert_word_to_pdf(task: WordConvertTask) -> Result<WordConvertResult, String> {
    tokio::task::spawn_blocking(move || Ok(convert_word_to_pdf_single(&task)))
        .await
        .map_err(|e| format!("Word conversion execution failed: {}", e))?
}

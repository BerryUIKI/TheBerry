use super::hash::{calculate_file_checksums, FileChecksums};
use super::rename::{execute_batch_rename, BatchRenameResult, RenameItem};

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

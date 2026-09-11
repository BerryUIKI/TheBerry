use super::service::{ConvertResult, ConvertTask, ImageConverterService};

#[tauri::command]
pub async fn convert_images(tasks: Vec<ConvertTask>) -> Result<Vec<ConvertResult>, String> {
    tokio::task::spawn_blocking(move || ImageConverterService::convert_batch(tasks))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn convert_single_image(task: ConvertTask) -> Result<ConvertResult, String> {
    tokio::task::spawn_blocking(move || ImageConverterService::convert_single(task))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_image_paths(paths: Vec<String>, recursive: Option<bool>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || ImageConverterService::scan_image_paths(paths, recursive.unwrap_or(true)))
        .await
        .map_err(|e| e.to_string())
}


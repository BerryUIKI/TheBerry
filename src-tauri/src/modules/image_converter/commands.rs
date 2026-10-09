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

#[tauri::command]
pub async fn get_image_thumbnail(path: String) -> Result<Option<String>, String> {
    use std::sync::{Arc, LazyLock};
    static WORKERS: LazyLock<Arc<tokio::sync::Semaphore>> =
        LazyLock::new(|| Arc::new(tokio::sync::Semaphore::new(2)));
    let permit = WORKERS
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        super::thumbnail::get_image_thumbnail(std::path::Path::new(&path))
    })
    .await
    .map_err(|e| e.to_string())
}

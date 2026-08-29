use super::service::{ConvertResult, ConvertTask, ImageConverterService};

#[tauri::command]
pub async fn convert_images(tasks: Vec<ConvertTask>) -> Result<Vec<ConvertResult>, String> {
    tokio::task::spawn_blocking(move || ImageConverterService::convert_batch(tasks))
        .await
        .map_err(|e| e.to_string())
}

use super::indexer::{FileSearchEngine, SearchQuery, SearchResultItem, SystemDrive};

#[tauri::command]
pub async fn search_files(query: SearchQuery) -> Result<Vec<SearchResultItem>, String> {
    tokio::task::spawn_blocking(move || FileSearchEngine::search(query))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_system_drives() -> Vec<SystemDrive> {
    FileSearchEngine::get_available_drives()
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    FileSearchEngine::reveal_in_explorer(&path)
}

#[tauri::command]
pub fn open_file_path(path: String) -> Result<(), String> {
    FileSearchEngine::open_file_or_folder(&path)
}

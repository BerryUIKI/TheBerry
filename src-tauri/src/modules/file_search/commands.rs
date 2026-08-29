use super::indexer::{FileSearchEngine, SearchQuery, SearchResultItem};

#[tauri::command]
pub async fn search_files(query: SearchQuery) -> Result<Vec<SearchResultItem>, String> {
    tokio::task::spawn_blocking(move || FileSearchEngine::search(query))
        .await
        .map_err(|e| e.to_string())
}

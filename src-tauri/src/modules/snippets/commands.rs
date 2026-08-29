use tauri::State;
use crate::core::AppState;
use super::service::{SnippetItem, SnippetPayload, SnippetService};

#[tauri::command]
pub fn get_snippets(state: State<AppState>) -> Result<Vec<SnippetItem>, String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.get_snippets()
}

#[tauri::command]
pub fn save_snippet(payload: SnippetPayload, state: State<AppState>) -> Result<SnippetItem, String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.save_snippet(payload)
}

#[tauri::command]
pub fn delete_snippet(id: String, state: State<AppState>) -> Result<(), String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.delete_snippet(&id)
}

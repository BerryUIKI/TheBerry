use tauri::State;
use crate::core::AppState;
use super::service::{SnippetItem, SnippetPayload, SnippetService};
use super::template::TemplateEngine;

#[tauri::command]
pub fn get_snippets(state: State<AppState>) -> Result<Vec<SnippetItem>, String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.get_snippets()
}

#[tauri::command]
pub fn save_snippet(
    payload: SnippetPayload,
    state: State<AppState>,
) -> Result<SnippetItem, String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.save_snippet(payload)
}

#[tauri::command]
pub fn delete_snippet(id: String, state: State<AppState>) -> Result<(), String> {
    let service = SnippetService::new(state.db_manager.clone());
    service.delete_snippet(&id)
}

#[tauri::command]
pub fn expand_snippet_template(content: String) -> String {
    TemplateEngine::expand(&content)
}

#[tauri::command]
pub fn copy_expanded_snippet(content: String) -> Result<String, String> {
    let expanded = TemplateEngine::expand(&content);
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Failed to access OS clipboard: {}", e))?;
    clipboard
        .set_text(expanded.clone())
        .map_err(|e| format!("Failed to set clipboard text: {}", e))?;
    Ok(expanded)
}

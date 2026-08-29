use std::sync::Arc;
use tempfile::tempdir;
use the_berry_lib::core::database::DatabaseManager;
use the_berry_lib::modules::snippets::service::{SnippetPayload, SnippetService};

#[test]
fn test_snippet_crud_and_favorites() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(&temp.path().to_path_buf()).expect("failed to init db");

    let service = SnippetService::new(db_manager);

    let snippet = service
        .save_snippet(SnippetPayload {
            id: None,
            title: "Rust Mutex Boilerplate".to_string(),
            description: Some("Thread-safe Arc<Mutex<T>>".to_string()),
            content: "let data = Arc::new(Mutex::new(0));".to_string(),
            language: Some("rust".to_string()),
            category: Some("Concurrency".to_string()),
            tags: Some(vec!["rust".to_string(), "threading".to_string()]),
            is_favorite: Some(false),
        })
        .expect("save snippet");

    assert_eq!(snippet.title, "Rust Mutex Boilerplate");
    assert_eq!(snippet.language, "rust");

    let list = service.get_snippets().expect("get snippets");
    assert_eq!(list.len(), 1);

    // Update snippet to favorite
    let updated = service
        .save_snippet(SnippetPayload {
            id: Some(snippet.id.clone()),
            title: "Rust Mutex Boilerplate Updated".to_string(),
            description: snippet.description.into(),
            content: snippet.content,
            language: Some(snippet.language),
            category: Some(snippet.category),
            tags: Some(snippet.tags),
            is_favorite: Some(true),
        })
        .expect("update snippet");

    assert!(updated.is_favorite);
    assert_eq!(updated.title, "Rust Mutex Boilerplate Updated");

    // Delete snippet
    service.delete_snippet(&snippet.id).expect("delete snippet");
    let empty_list = service.get_snippets().expect("get empty list");
    assert!(empty_list.is_empty());
}

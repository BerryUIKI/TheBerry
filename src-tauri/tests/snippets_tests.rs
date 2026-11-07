use std::sync::Arc;
use tempfile::tempdir;
use the_berry_lib::core::database::{DatabaseManager, SNIPPETS_TABLE};
use the_berry_lib::modules::snippets::service::{SnippetPayload, SnippetService};

#[test]
fn test_snippet_crud_and_favorites() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

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
    let original_created_at = snippet.created_at;

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
    assert_eq!(updated.created_at, original_created_at);

    // Delete snippet
    service.delete_snippet(&snippet.id).expect("delete snippet");
    let empty_list = service.get_snippets().expect("get empty list");
    assert!(empty_list.is_empty());
}

#[test]
fn test_malformed_snippet_row_is_reported() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let write_txn = db_manager.get_db().expect("db").begin_write().expect("write txn");
    {
        let mut table = write_txn.open_table(SNIPPETS_TABLE).expect("open table");
        table
            .insert("broken", b"not-json".as_slice())
            .expect("insert malformed row");
    }
    write_txn.commit().expect("commit");

    let service = SnippetService::new(db_manager);
    let error = service.get_snippets().expect_err("malformed row should fail");
    assert!(error.contains("decode snippet row"), "unexpected error: {error}");
}

#[test]
fn test_snippet_template_expansion() {
    use the_berry_lib::modules::snippets::template::TemplateEngine;

    let raw = "Date: ${CURRENT_DATE}, UUID: ${UUID}";
    let expanded = TemplateEngine::expand(raw);

    assert!(!expanded.contains("${CURRENT_DATE}"));
    assert!(!expanded.contains("${UUID}"));
    assert!(expanded.contains("Date: 202"));
}

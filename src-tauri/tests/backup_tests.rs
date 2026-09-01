use std::sync::Arc;
use tempfile::tempdir;
use the_berry_lib::core::config::ConfigManager;
use the_berry_lib::core::database::DatabaseManager;
use the_berry_lib::modules::backup::service::BackupService;
use the_berry_lib::modules::clipboard::service::ClipboardService;
use the_berry_lib::modules::snippets::service::{SnippetPayload, SnippetService};

#[test]
fn test_full_backup_export_and_import_lifecycle() {
    let temp1 = tempdir().expect("failed to create temp dir 1");
    let db_manager1 = Arc::new(DatabaseManager::new());
    db_manager1.initialize(&temp1.path().to_path_buf()).expect("failed to init db 1");
    let config_manager1 = Arc::new(ConfigManager::new());
    let _ = config_manager1.save_bootstrap(&temp1.path().to_string_lossy());
    let _ = config_manager1.load_app_config(&temp1.path().to_path_buf());

    // Add clipboard and snippet items
    let clip_service = ClipboardService::new(db_manager1.clone());
    clip_service.add_item("Backup Test Snippet".to_string(), "text".to_string()).unwrap();

    let snippet_service = SnippetService::new(db_manager1.clone());
    snippet_service
        .save_snippet(SnippetPayload {
            id: None,
            title: "Test Snippet".to_string(),
            description: Some("Test description".to_string()),
            content: "console.log('hello');".to_string(),
            language: Some("typescript".to_string()),
            category: Some("General".to_string()),
            tags: Some(vec!["test".to_string()]),
            is_favorite: Some(true),
        })
        .unwrap();

    // Export full backup
    let backup_service1 = BackupService::new(db_manager1.clone(), config_manager1.clone());
    let backup_json = backup_service1.export_backup_json().expect("export backup json");
    assert!(backup_json.contains("Backup Test Snippet"));
    assert!(backup_json.contains("Test Snippet"));

    // Create a new clean database instance (temp2)
    let temp2 = tempdir().expect("failed to create temp dir 2");
    let db_manager2 = Arc::new(DatabaseManager::new());
    db_manager2.initialize(&temp2.path().to_path_buf()).expect("failed to init db 2");
    let config_manager2 = Arc::new(ConfigManager::new());
    let _ = config_manager2.save_bootstrap(&temp2.path().to_string_lossy());
    let _ = config_manager2.load_app_config(&temp2.path().to_path_buf());

    // Import backup into database 2
    let backup_service2 = BackupService::new(db_manager2.clone(), config_manager2.clone());
    let summary = backup_service2.import_backup_json(&backup_json).expect("import backup json");
    assert_eq!(summary.clipboard_count, 1);
    assert_eq!(summary.snippets_count, 1);

    // Verify imported data in database 2
    let clip_service2 = ClipboardService::new(db_manager2.clone());
    let history = clip_service2.get_history().unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].content, "Backup Test Snippet");

    let snippet_service2 = SnippetService::new(db_manager2.clone());
    let snippets = snippet_service2.get_snippets().unwrap();
    assert_eq!(snippets.len(), 1);
    assert_eq!(snippets[0].title, "Test Snippet");
}

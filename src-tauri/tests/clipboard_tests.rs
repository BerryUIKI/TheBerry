use std::sync::Arc;
use tempfile::tempdir;
use the_berry_lib::core::database::DatabaseManager;
use the_berry_lib::modules::clipboard::service::ClipboardService;

#[test]
fn test_clipboard_add_and_get_history() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = ClipboardService::new(db_manager);

    let item1 = service.add_item("Hello World".to_string(), "text".to_string()).expect("add item 1");
    let item2 = service.add_item("https://github.com".to_string(), "text".to_string()).expect("add item 2");

    let history = service.get_history().expect("get history");
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].id, item2.id); // Newest first

    // Toggle pin on item1
    let pinned = service.toggle_pin(&item1.id).expect("toggle pin");
    assert!(pinned.is_pinned);

    // Pinned should now be first
    let history_after_pin = service.get_history().expect("get history after pin");
    assert_eq!(history_after_pin[0].id, item1.id);
}

#[test]
fn test_clipboard_delete_and_clear_unpinned() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = ClipboardService::new(db_manager);

    let item1 = service.add_item("Pinned Item".to_string(), "text".to_string()).expect("add 1");
    let _item2 = service.add_item("Unpinned Item".to_string(), "text".to_string()).expect("add 2");

    service.toggle_pin(&item1.id).expect("pin item 1");

    // Clear unpinned
    let removed = service.clear_unpinned().expect("clear unpinned");
    assert_eq!(removed, 1);

    let history = service.get_history().expect("get history");
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].id, item1.id);

    // Delete item1
    service.delete_item(&item1.id).expect("delete item 1");
    let empty_history = service.get_history().expect("get empty history");
    assert!(empty_history.is_empty());
}

#[test]
fn test_clipboard_reject_empty() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = ClipboardService::new(db_manager);
    let result = service.add_item("   ".to_string(), "text".to_string());
    assert!(result.is_err());
}

#[test]
fn test_clipboard_add_image_item() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = ClipboardService::new(db_manager);

    // Create 32x32 synthetic RGBA buffer (4096 bytes)
    let rgba_bytes = vec![255u8; 32 * 32 * 4];
    let img_item = service
        .add_image_item(32, 32, &rgba_bytes, Some(temp.path()))
        .expect("add image item");

    assert_eq!(img_item.content_type, "image");
    assert_eq!(img_item.image_width, Some(32));
    assert_eq!(img_item.image_height, Some(32));
    assert!(img_item.media_data_url.is_some());
    assert!(img_item.media_path.is_some());

    let history = service.get_history().expect("get history with image");
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].id, img_item.id);
}

#[test]
fn test_clipboard_search_history() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = ClipboardService::new(db_manager);

    let item1 = service.add_item("SELECT * FROM users;".to_string(), "text".to_string()).unwrap();
    let item2 = service.add_item("https://tauri.app/docs".to_string(), "text".to_string()).unwrap();
    let _item3 = service.add_item("rustc --version".to_string(), "text".to_string()).unwrap();

    service.toggle_pin(&item1.id).unwrap();

    // Query 'users'
    let hits = service.search_history("users", None, None, None).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].id, item1.id);

    // Query 'https'
    let url_hits = service.search_history("https", None, None, None).unwrap();
    assert_eq!(url_hits.len(), 1);
    assert_eq!(url_hits[0].id, item2.id);

    // Query pinned only
    let pinned_hits = service.search_history("", None, Some(true), None).unwrap();
    assert_eq!(pinned_hits.len(), 1);
    assert_eq!(pinned_hits[0].id, item1.id);
}

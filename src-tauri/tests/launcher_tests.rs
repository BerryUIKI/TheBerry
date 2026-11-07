use std::sync::Arc;
use tempfile::tempdir;
use the_berry_lib::core::database::{DatabaseManager, LAUNCHER_TABLE};
use the_berry_lib::modules::launcher::service::{LauncherPayload, LauncherService};

#[test]
fn test_launcher_crud_and_attributes() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let service = LauncherService::new(db_manager.clone());

    let item = service
        .save_item(LauncherPayload {
            id: None,
            name: "VS Code Editor".to_string(),
            description: Some("Open VSCode".to_string()),
            exec_path: "code".to_string(),
            arguments: Some(vec![".".to_string()]),
            working_dir: None,
            category: Some("Development".to_string()),
            is_favorite: Some(true),
            is_batch: Some(false),
            batch_commands: None,
        })
        .expect("save launcher item");

    assert_eq!(item.name, "VS Code Editor");
    assert!(item.is_favorite);
    assert_eq!(item.launch_count, 0);
    let original_created_at = item.created_at;

    // Simulate a previously launched item, then update it through the service.
    let mut launched = item.clone();
    launched.launch_count = 5;
    let write_txn = db_manager.get_db().expect("db").begin_write().expect("write txn");
    {
        let mut table = write_txn.open_table(LAUNCHER_TABLE).expect("open table");
        table
            .insert(
                launched.id.as_str(),
                serde_json::to_vec(&launched).expect("serialize launched item").as_slice(),
            )
            .expect("store launched item");
    }
    write_txn.commit().expect("commit");

    let updated = service
        .save_item(LauncherPayload {
            id: Some(item.id.clone()),
            name: "VS Code Editor Updated".to_string(),
            description: Some(item.description.clone()),
            exec_path: item.exec_path.clone(),
            arguments: Some(item.arguments.clone()),
            working_dir: item.working_dir.clone(),
            category: Some(item.category.clone()),
            is_favorite: Some(item.is_favorite),
            is_batch: Some(item.is_batch),
            batch_commands: Some(item.batch_commands.clone()),
        })
        .expect("update launcher item");
    assert_eq!(updated.launch_count, 5);
    assert_eq!(updated.created_at, original_created_at);

    let list = service.get_items().expect("get items");
    assert_eq!(list.len(), 1);

    // Test batch item
    let batch_item = service
        .save_item(LauncherPayload {
            id: None,
            name: "Multi-Instance Batch".to_string(),
            description: Some("Batch run".to_string()),
            exec_path: String::new(),
            arguments: None,
            working_dir: None,
            category: Some("Batch".to_string()),
            is_favorite: Some(false),
            is_batch: Some(true),
            batch_commands: Some(vec!["echo 1".to_string(), "echo 2".to_string()]),
        })
        .expect("save batch item");

    assert!(batch_item.is_batch);
    assert_eq!(batch_item.batch_commands.len(), 2);

    // Delete item
    service.delete_item(&item.id).expect("delete item");
    let remaining = service.get_items().expect("get remaining");
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, batch_item.id);
}

#[test]
fn test_malformed_launcher_row_is_reported() {
    let temp = tempdir().expect("failed to create temp dir");
    let db_manager = Arc::new(DatabaseManager::new());
    db_manager.initialize(temp.path()).expect("failed to init db");

    let write_txn = db_manager.get_db().expect("db").begin_write().expect("write txn");
    {
        let mut table = write_txn.open_table(LAUNCHER_TABLE).expect("open table");
        table
            .insert("broken", b"not-json".as_slice())
            .expect("insert malformed row");
    }
    write_txn.commit().expect("commit");

    let service = LauncherService::new(db_manager);
    let error = service.get_items().expect_err("malformed row should fail");
    assert!(error.contains("decode launcher item row"), "unexpected error: {error}");
}

#[test]
fn test_start_menu_scanner() {
    use the_berry_lib::modules::launcher::scanner::AppScanner;
    let apps = AppScanner::scan_start_menu_apps();
    // Verify scanner executes cleanly without panic
    println!("Discovered {} apps", apps.len());
}

#[test]
fn test_parse_command_line() {
    let parts = LauncherService::parse_command_line(r#"notepad.exe "C:\My Files\notes.txt" --read-only 'arg with spaces'"#);
    assert_eq!(parts, vec![
        "notepad.exe".to_string(),
        r#"C:\My Files\notes.txt"#.to_string(),
        "--read-only".to_string(),
        "arg with spaces".to_string()
    ]);
}

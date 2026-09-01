use tempfile::tempdir;
use the_berry_lib::core::config::ConfigManager;
use the_berry_lib::core::database::DatabaseManager;
use the_berry_lib::core::paths::{ensure_directory_exists, get_suggested_data_dir};

#[test]
fn test_suggested_data_dir_not_empty() {
    let suggested = get_suggested_data_dir();
    assert!(!suggested.to_string_lossy().is_empty());
    assert!(suggested.to_string_lossy().contains("BerryAppData"));
}

#[test]
fn test_ensure_directory_exists() {
    let temp = tempdir().expect("failed to create temp dir");
    let nested = temp.path().join("sub").join("nested");
    assert!(!nested.exists());

    ensure_directory_exists(&nested).expect("failed to ensure dir");
    assert!(nested.exists());
}

#[test]
fn test_config_manager_load_save() {
    let temp = tempdir().expect("failed to create temp dir");
    let data_dir = temp.path().to_path_buf();

    let manager = ConfigManager::new();
    let initial_config = manager.load_app_config(&data_dir).expect("failed to load initial config");

    assert_eq!(initial_config.version, "0.1.2");
    assert_eq!(initial_config.theme, "dark");
    assert!(initial_config.close_to_tray);

    let mut modified = initial_config.clone();
    modified.theme = "light".to_string();
    modified.clipboard_history_limit = 500;

    manager.save_app_config(&data_dir, &modified).expect("failed to save config");

    let loaded = manager.load_app_config(&data_dir).expect("failed to reload config");
    assert_eq!(loaded.theme, "light");
    assert_eq!(loaded.clipboard_history_limit, 500);
}

#[test]
fn test_database_manager_lifecycle() {
    let temp = tempdir().expect("failed to create temp dir");
    let data_dir = temp.path().to_path_buf();

    let db_manager = DatabaseManager::new();
    assert!(!db_manager.is_ready());

    db_manager.initialize(&data_dir).expect("failed to initialize db");
    assert!(db_manager.is_ready());

    let db = db_manager.get_db().expect("failed to get db");
    let read_txn = db.begin_read().expect("failed to begin read");
    drop(read_txn);
}

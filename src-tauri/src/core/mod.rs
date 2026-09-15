pub mod config;
pub mod database;
pub mod paths;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use config::ConfigManager;
use database::DatabaseManager;
use crate::modules::folder_sync::service::FolderSyncService;
use crate::modules::goose::service::GooseService;

pub struct AppState {
    pub config_manager: Arc<ConfigManager>,
    pub db_manager: Arc<DatabaseManager>,
    pub goose_service: Arc<GooseService>,
    pub folder_sync_service: Arc<FolderSyncService>,
    pub shutdown_flag: Arc<AtomicBool>,
    pub shutdown_tx: tokio::sync::watch::Sender<bool>,
    pub clipboard_monitor_enabled: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        let config_manager = Arc::new(ConfigManager::new());
        let db_manager = Arc::new(DatabaseManager::new());
        let goose_service = Arc::new(GooseService::new());
        let shutdown_flag = Arc::new(AtomicBool::new(false));
        let (shutdown_tx, _) = tokio::sync::watch::channel(false);

        let mut initial_monitor = true;

        // If already initialized, attempt to open the database and load config
        if let Some(data_dir) = config_manager.get_data_dir() {
            if data_dir.exists() {
                if let Ok(cfg) = config_manager.load_app_config(&data_dir) {
                    initial_monitor = cfg.clipboard_monitor_enabled;
                }
                let _ = db_manager.initialize(&data_dir);
            }
        }

        let clipboard_monitor_enabled = Arc::new(AtomicBool::new(initial_monitor));
        let folder_sync_service = Arc::new(FolderSyncService::new(db_manager.clone()));

        Self {
            config_manager,
            db_manager,
            goose_service,
            folder_sync_service,
            shutdown_flag,
            shutdown_tx,
            clipboard_monitor_enabled,
        }
    }

    pub fn trigger_shutdown(&self) {
        self.shutdown_flag.store(true, std::sync::atomic::Ordering::SeqCst);
        let _ = self.shutdown_tx.send(true);
    }
}


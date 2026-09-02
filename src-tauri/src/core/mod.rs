pub mod config;
pub mod database;
pub mod paths;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use config::ConfigManager;
use database::DatabaseManager;
use crate::modules::goose::service::GooseService;

pub struct AppState {
    pub config_manager: Arc<ConfigManager>,
    pub db_manager: Arc<DatabaseManager>,
    pub goose_service: Arc<GooseService>,
    pub shutdown_flag: Arc<AtomicBool>,
    pub shutdown_tx: tokio::sync::watch::Sender<bool>,
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

        // If already initialized, attempt to open the database and load config
        if let Some(data_dir) = config_manager.get_data_dir() {
            if data_dir.exists() {
                let _ = config_manager.load_app_config(&data_dir);
                let _ = db_manager.initialize(&data_dir);
            }
        }

        Self {
            config_manager,
            db_manager,
            goose_service,
            shutdown_flag,
            shutdown_tx,
        }
    }

    pub fn trigger_shutdown(&self) {
        self.shutdown_flag.store(true, std::sync::atomic::Ordering::SeqCst);
        let _ = self.shutdown_tx.send(true);
    }
}


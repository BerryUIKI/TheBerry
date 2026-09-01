pub mod config;
pub mod database;
pub mod paths;

use std::sync::Arc;
use config::ConfigManager;
use database::DatabaseManager;
use crate::modules::goose::service::GooseService;

pub struct AppState {
    pub config_manager: Arc<ConfigManager>,
    pub db_manager: Arc<DatabaseManager>,
    pub goose_service: Arc<GooseService>,
}

impl AppState {
    pub fn new() -> Self {
        let config_manager = Arc::new(ConfigManager::new());
        let db_manager = Arc::new(DatabaseManager::new());
        let goose_service = Arc::new(GooseService::new());

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
        }
    }
}


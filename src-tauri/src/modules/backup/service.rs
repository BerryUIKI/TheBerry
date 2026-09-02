use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use redb::ReadableTable;

use crate::core::config::{AppConfig, ConfigManager};
use crate::core::database::{DatabaseManager, CLIPBOARD_TABLE, LAUNCHER_TABLE, SNIPPETS_TABLE};
use crate::modules::clipboard::service::ClipboardItem;
use crate::modules::launcher::service::LauncherItem;
use crate::modules::snippets::service::SnippetItem;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullBackupData {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub config: AppConfig,
    pub clipboard_items: Vec<ClipboardItem>,
    pub snippets: Vec<SnippetItem>,
    pub launcher_items: Vec<LauncherItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSummary {
    pub clipboard_count: usize,
    pub snippets_count: usize,
    pub launcher_count: usize,
    pub created_at: DateTime<Utc>,
}

pub struct BackupService {
    db_manager: Arc<DatabaseManager>,
    config_manager: Arc<ConfigManager>,
}

impl BackupService {
    pub fn new(db_manager: Arc<DatabaseManager>, config_manager: Arc<ConfigManager>) -> Self {
        Self {
            db_manager,
            config_manager,
        }
    }

    /// Exports all database tables and config to a unified JSON string
    pub fn export_backup_json(&self) -> Result<String, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db.begin_read().map_err(|e| e.to_string())?;

        // Read clipboard items
        let mut clipboard_items = Vec::new();
        if let Ok(table) = read_txn.open_table(CLIPBOARD_TABLE) {
            let mut iter = table.iter().map_err(|e| e.to_string())?;
            while let Some(Ok((_k, val))) = iter.next() {
                if let Ok(item) = serde_json::from_slice::<ClipboardItem>(val.value()) {
                    clipboard_items.push(item);
                }
            }
        }

        // Read snippets
        let mut snippets = Vec::new();
        if let Ok(table) = read_txn.open_table(SNIPPETS_TABLE) {
            let mut iter = table.iter().map_err(|e| e.to_string())?;
            while let Some(Ok((_k, val))) = iter.next() {
                if let Ok(item) = serde_json::from_slice::<SnippetItem>(val.value()) {
                    snippets.push(item);
                }
            }
        }

        // Read launcher items
        let mut launcher_items = Vec::new();
        if let Ok(table) = read_txn.open_table(LAUNCHER_TABLE) {
            let mut iter = table.iter().map_err(|e| e.to_string())?;
            while let Some(Ok((_k, val))) = iter.next() {
                if let Ok(item) = serde_json::from_slice::<LauncherItem>(val.value()) {
                    launcher_items.push(item);
                }
            }
        }

        let config = self.config_manager.get_app_config();

        let backup = FullBackupData {
            version: "0.1.2".to_string(),
            created_at: Utc::now(),
            config,
            clipboard_items,
            snippets,
            launcher_items,
        };

        serde_json::to_string_pretty(&backup).map_err(|e| format!("Failed to serialize backup: {}", e))
    }

    /// Restores database tables and configuration from backup JSON
    pub fn import_backup_json(&self, json_content: &str) -> Result<BackupSummary, String> {
        let backup: FullBackupData = serde_json::from_str(json_content)
            .map_err(|e| format!("Invalid backup JSON structure: {}", e))?;

        // Create safety backup snapshot before overwriting database
        if let Ok(current_backup) = self.export_backup_json() {
            if let Some(dir) = self.config_manager.get_data_dir() {
                let safety_dir = dir.join("backups");
                let _ = std::fs::create_dir_all(&safety_dir);
                let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
                let safety_file = safety_dir.join(format!("pre_restore_safety_{}.json", timestamp));
                let _ = std::fs::write(safety_file, current_backup);
            }
        }

        let db = self.db_manager.get_db()?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;

        let mut clip_count = 0;
        let mut snip_count = 0;
        let mut launch_count = 0;

        {
            let mut clip_table = write_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;
            for item in &backup.clipboard_items {
                if let Ok(bytes) = serde_json::to_vec(item) {
                    let _ = clip_table.insert(item.id.as_str(), bytes.as_slice());
                    clip_count += 1;
                }
            }

            let mut snip_table = write_txn.open_table(SNIPPETS_TABLE).map_err(|e| e.to_string())?;
            for item in &backup.snippets {
                if let Ok(bytes) = serde_json::to_vec(item) {
                    let _ = snip_table.insert(item.id.as_str(), bytes.as_slice());
                    snip_count += 1;
                }
            }

            let mut launch_table = write_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;
            for item in &backup.launcher_items {
                if let Ok(bytes) = serde_json::to_vec(item) {
                    let _ = launch_table.insert(item.id.as_str(), bytes.as_slice());
                    launch_count += 1;
                }
            }
        }

        write_txn.commit().map_err(|e| e.to_string())?;

        // Update config if data dir is available
        if let Some(dir) = self.config_manager.get_data_dir() {
            let _ = self.config_manager.save_app_config(&dir, &backup.config);
        }

        Ok(BackupSummary {
            clipboard_count: clip_count,
            snippets_count: snip_count,
            launcher_count: launch_count,
            created_at: backup.created_at,
        })
    }
}

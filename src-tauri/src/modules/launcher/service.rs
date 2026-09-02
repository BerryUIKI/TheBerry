use chrono::{DateTime, Utc};
use redb::ReadableTable;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::database::{DatabaseManager, LAUNCHER_TABLE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub exec_path: String,
    pub arguments: Vec<String>,
    pub working_dir: Option<String>,
    pub category: String,
    pub is_favorite: bool,
    pub is_batch: bool,
    pub batch_commands: Vec<String>,
    pub launch_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LauncherPayload {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub exec_path: String,
    pub arguments: Option<Vec<String>>,
    pub working_dir: Option<String>,
    pub category: Option<String>,
    pub is_favorite: Option<bool>,
    pub is_batch: Option<bool>,
    pub batch_commands: Option<Vec<String>>,
}

pub struct LauncherService {
    db_manager: Arc<DatabaseManager>,
}

impl LauncherService {
    pub fn new(db_manager: Arc<DatabaseManager>) -> Self {
        Self { db_manager }
    }

    pub fn get_items(&self) -> Result<Vec<LauncherItem>, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db.begin_read().map_err(|e| e.to_string())?;
        let table = read_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        let mut iter = table.iter().map_err(|e| e.to_string())?;
        while let Some(Ok((_key, val))) = iter.next() {
            if let Ok(item) = serde_json::from_slice::<LauncherItem>(val.value()) {
                items.push(item);
            }
        }

        items.sort_by(|a, b| {
            b.is_favorite
                .cmp(&a.is_favorite)
                .then_with(|| b.launch_count.cmp(&a.launch_count))
                .then_with(|| a.name.cmp(&b.name))
        });

        Ok(items)
    }

    pub fn save_item(&self, payload: LauncherPayload) -> Result<LauncherItem, String> {
        let db = self.db_manager.get_db()?;
        let now = Utc::now();
        let id = payload.id.unwrap_or_else(|| Uuid::new_v4().to_string());

        let mut launch_count = 0;
        let created_at = now;

        // Keep existing launch count and created_at if updating
        if let Ok(read_txn) = db.begin_read() {
            if let Ok(table) = read_txn.open_table(LAUNCHER_TABLE) {
                if let Ok(Some(val)) = table.get(id.as_str()) {
                    if let Ok(existing) = serde_json::from_slice::<LauncherItem>(val.value()) {
                        launch_count = existing.launch_count;
                    }
                }
            }
        }

        let item = LauncherItem {
            id: id.clone(),
            name: payload.name,
            description: payload.description.unwrap_or_default(),
            exec_path: payload.exec_path,
            arguments: payload.arguments.unwrap_or_default(),
            working_dir: payload.working_dir,
            category: payload.category.unwrap_or_else(|| "Apps".to_string()),
            is_favorite: payload.is_favorite.unwrap_or(false),
            is_batch: payload.is_batch.unwrap_or(false),
            batch_commands: payload.batch_commands.unwrap_or_default(),
            launch_count,
            created_at,
            updated_at: now,
        };

        let serialized = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;
            table.insert(id.as_str(), serialized.as_slice()).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;

        Ok(item)
    }

    pub fn delete_item(&self, id: &str) -> Result<(), String> {
        let db = self.db_manager.get_db()?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;
            table.remove(id).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn parse_command_line(cmd: &str) -> Vec<String> {
        let mut args = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut quote_char = ' ';

        for c in cmd.chars() {
            match c {
                '"' | '\'' if !in_quotes => {
                    in_quotes = true;
                    quote_char = c;
                }
                c if in_quotes && c == quote_char => {
                    in_quotes = false;
                }
                c if c.is_whitespace() && !in_quotes => {
                    if !current.is_empty() {
                        args.push(current);
                        current = String::new();
                    }
                }
                _ => {
                    current.push(c);
                }
            }
        }
        if !current.is_empty() {
            args.push(current);
        }
        args
    }

    pub fn launch(&self, id: &str) -> Result<String, String> {
        let db = self.db_manager.get_db()?;
        let mut item_opt: Option<LauncherItem> = None;

        {
            let read_txn = db.begin_read().map_err(|e| e.to_string())?;
            let table = read_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;
            if let Some(val) = table.get(id).map_err(|e| e.to_string())? {
                item_opt = serde_json::from_slice(val.value()).ok();
            }
        }

        let mut item = item_opt.ok_or_else(|| "Launcher item not found".to_string())?;

        if item.is_batch {
            for cmd_str in &item.batch_commands {
                let parts = Self::parse_command_line(cmd_str.trim());
                if parts.is_empty() {
                    continue;
                }
                let mut cmd = Command::new(&parts[0]);
                if parts.len() > 1 {
                    cmd.args(&parts[1..]);
                }
                if let Some(ref dir) = item.working_dir {
                    if !dir.is_empty() {
                        cmd.current_dir(dir);
                    }
                }
                cmd.spawn()
                    .map_err(|e| format!("Failed to spawn batch command '{}': {}", cmd_str, e))?;
            }
        } else {
            let mut cmd = Command::new(&item.exec_path);
            cmd.args(&item.arguments);
            if let Some(ref dir) = item.working_dir {
                if !dir.is_empty() {
                    cmd.current_dir(dir);
                }
            }
            cmd.spawn()
                .map_err(|e| format!("Failed to launch '{}': {}", item.exec_path, e))?;
        }

        // Increment launch counter
        item.launch_count += 1;
        let serialized = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(LAUNCHER_TABLE).map_err(|e| e.to_string())?;
            table.insert(id, serialized.as_slice()).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;

        Ok(format!("Successfully launched {}", item.name))
    }
}

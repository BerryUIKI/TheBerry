use chrono::{DateTime, Utc};
use redb::ReadableTable;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::core::database::{DatabaseManager, CLIPBOARD_TABLE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: String, // "text" | "image" | "file" | "html"
    pub content: String,
    pub preview: String,
    pub is_pinned: bool,
    pub char_count: usize,
    pub created_at: DateTime<Utc>,
}

pub struct ClipboardService {
    db_manager: Arc<DatabaseManager>,
}

impl ClipboardService {
    pub fn new(db_manager: Arc<DatabaseManager>) -> Self {
        Self { db_manager }
    }

    pub fn get_history(&self) -> Result<Vec<ClipboardItem>, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db.begin_read().map_err(|e| e.to_string())?;
        let table = read_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        let mut iter = table.iter().map_err(|e| e.to_string())?;
        while let Some(Ok((_key, val))) = iter.next() {
            if let Ok(item) = serde_json::from_slice::<ClipboardItem>(val.value()) {
                items.push(item);
            }
        }

        // Sort: pinned first, then newest first
        items.sort_by(|a, b| {
            b.is_pinned
                .cmp(&a.is_pinned)
                .then_with(|| b.created_at.cmp(&a.created_at))
        });

        Ok(items)
    }

    pub fn add_item(&self, content: String, content_type: String) -> Result<ClipboardItem, String> {
        let trimmed = content.trim().to_string();
        if trimmed.is_empty() {
            return Err("Cannot add empty clipboard content".to_string());
        }

        let db = self.db_manager.get_db()?;
        let preview = if trimmed.len() > 140 {
            format!("{}...", &trimmed[..140])
        } else {
            trimmed.clone()
        };

        let item = ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type,
            content: trimmed,
            preview,
            is_pinned: false,
            char_count: content.chars().count(),
            created_at: Utc::now(),
        };

        let serialized = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;
            table.insert(item.id.as_str(), serialized.as_slice()).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;

        Ok(item)
    }

    pub fn toggle_pin(&self, id: &str) -> Result<ClipboardItem, String> {
        let db = self.db_manager.get_db()?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        let mut updated_item: Option<ClipboardItem> = None;
        {
            let mut table = write_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;
            let existing = {
                let guard = table.get(id).map_err(|e| e.to_string())?;
                if let Some(val) = guard {
                    serde_json::from_slice::<ClipboardItem>(val.value()).ok()
                } else {
                    None
                }
            };
            if let Some(mut item) = existing {
                item.is_pinned = !item.is_pinned;
                let serialized = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
                table.insert(id, serialized.as_slice()).map_err(|e| e.to_string())?;
                updated_item = Some(item);
            }
        }
        write_txn.commit().map_err(|e| e.to_string())?;

        updated_item.ok_or_else(|| "Clipboard item not found".to_string())
    }

    pub fn delete_item(&self, id: &str) -> Result<(), String> {
        let db = self.db_manager.get_db()?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;
            table.remove(id).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_unpinned(&self) -> Result<usize, String> {
        let db = self.db_manager.get_db()?;
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        let mut removed = 0;
        {
            let mut table = write_txn.open_table(CLIPBOARD_TABLE).map_err(|e| e.to_string())?;
            let mut to_remove = Vec::new();
            let mut iter = table.iter().map_err(|e| e.to_string())?;
            while let Some(Ok((key, val))) = iter.next() {
                if let Ok(item) = serde_json::from_slice::<ClipboardItem>(val.value()) {
                    if !item.is_pinned {
                        to_remove.push(key.value().to_string());
                    }
                }
            }
            for key in to_remove {
                table.remove(key.as_str()).map_err(|e| e.to_string())?;
                removed += 1;
            }
        }
        write_txn.commit().map_err(|e| e.to_string())?;
        Ok(removed)
    }

    pub fn copy_to_clipboard(content: &str) -> Result<(), String> {
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| format!("Failed to access OS clipboard: {}", e))?;
        clipboard
            .set_text(content.to_string())
            .map_err(|e| format!("Failed to set OS clipboard text: {}", e))?;
        Ok(())
    }

    /// Background listener daemon that monitors OS clipboard changes
    pub fn start_listener(db_manager: Arc<DatabaseManager>, app_handle: AppHandle) {
        std::thread::Builder::new()
            .name("clipboard-daemon".to_string())
            .spawn(move || {
                let mut last_text = String::new();
                let mut clipboard_opt: Option<arboard::Clipboard> = arboard::Clipboard::new().ok();

                loop {
                    std::thread::sleep(std::time::Duration::from_millis(600));

                    if !db_manager.is_ready() {
                        continue;
                    }

                    if clipboard_opt.is_none() {
                        clipboard_opt = arboard::Clipboard::new().ok();
                    }

                    if let Some(ref mut clip) = clipboard_opt {
                        if let Ok(current_text) = clip.get_text() {
                            let trimmed = current_text.trim().to_string();
                            if !trimmed.is_empty() && trimmed != last_text {
                                last_text = trimmed.clone();
                                let service = ClipboardService::new(db_manager.clone());
                                if let Ok(item) = service.add_item(trimmed, "text".to_string()) {
                                    let _ = app_handle.emit("clipboard-updated", item);
                                }
                            }
                        }
                    }
                }
            })
            .expect("Failed to spawn clipboard listener thread");
    }
}

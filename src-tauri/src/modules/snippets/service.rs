use chrono::{DateTime, Utc};
use redb::ReadableTable;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::core::database::{DatabaseManager, SNIPPETS_TABLE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    pub language: String,
    pub category: String,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SnippetPayload {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub content: String,
    pub language: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: Option<bool>,
}

pub struct SnippetService {
    db_manager: Arc<DatabaseManager>,
}

impl SnippetService {
    pub fn new(db_manager: Arc<DatabaseManager>) -> Self {
        Self { db_manager }
    }

    pub fn get_snippets(&self) -> Result<Vec<SnippetItem>, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db.begin_read().map_err(|e| e.to_string())?;
        let table = read_txn.open_table(SNIPPETS_TABLE).map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        let mut iter = table.iter().map_err(|e| e.to_string())?;
        while let Some(Ok((_key, val))) = iter.next() {
            if let Ok(item) = serde_json::from_slice::<SnippetItem>(val.value()) {
                items.push(item);
            }
        }

        items.sort_by(|a, b| {
            b.is_favorite
                .cmp(&a.is_favorite)
                .then_with(|| b.updated_at.cmp(&a.updated_at))
        });

        Ok(items)
    }

    pub fn save_snippet(&self, payload: SnippetPayload) -> Result<SnippetItem, String> {
        let db = self.db_manager.get_db()?;
        let now = Utc::now();
        let id = payload.id.unwrap_or_else(|| Uuid::new_v4().to_string());

        let item = SnippetItem {
            id: id.clone(),
            title: payload.title,
            description: payload.description.unwrap_or_default(),
            content: payload.content,
            language: payload.language.unwrap_or_else(|| "text".to_string()),
            category: payload.category.unwrap_or_else(|| "General".to_string()),
            tags: payload.tags.unwrap_or_default(),
            is_favorite: payload.is_favorite.unwrap_or(false),
            created_at: now,
            updated_at: now,
        };

        let serialized = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
        let _write_guard = self.db_manager.write_lock();
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(SNIPPETS_TABLE).map_err(|e| e.to_string())?;
            table.insert(id.as_str(), serialized.as_slice()).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;

        Ok(item)
    }

    pub fn delete_snippet(&self, id: &str) -> Result<(), String> {
        let db = self.db_manager.get_db()?;
        let _write_guard = self.db_manager.write_lock();
        let write_txn = db.begin_write().map_err(|e| e.to_string())?;
        {
            let mut table = write_txn.open_table(SNIPPETS_TABLE).map_err(|e| e.to_string())?;
            table.remove(id).map_err(|e| e.to_string())?;
        }
        write_txn.commit().map_err(|e| e.to_string())?;
        Ok(())
    }
}

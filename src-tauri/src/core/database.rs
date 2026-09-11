use parking_lot::RwLock;
use redb::{Database, TableDefinition};
use std::path::Path;
use std::sync::Arc;

pub const CLIPBOARD_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("clipboard_history");
pub const SNIPPETS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("snippets");
pub const LAUNCHER_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("launcher_items");
pub const KV_STORE_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("kv_store");

pub struct DatabaseManager {
    db: RwLock<Option<Arc<Database>>>,
    write_lock: parking_lot::Mutex<()>,
}

impl Default for DatabaseManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DatabaseManager {
    pub fn new() -> Self {
        Self {
            db: RwLock::new(None),
            write_lock: parking_lot::Mutex::new(()),
        }
    }

    pub fn write_lock(&self) -> parking_lot::MutexGuard<'_, ()> {
        self.write_lock.lock()
    }

    pub fn initialize(&self, data_dir: &Path) -> Result<(), String> {
        let _write_guard = self.write_lock.lock();
        let db_path = data_dir.join("the_berry.redb");
        let db = Database::create(&db_path).map_err(|e| format!("Failed to create redb database: {}", e))?;

        // Initialize tables
        let write_txn = db
            .begin_write()
            .map_err(|e| format!("Failed to begin write transaction: {}", e))?;
        {
            let _ = write_txn
                .open_table(CLIPBOARD_TABLE)
                .map_err(|e| format!("Failed to open clipboard table: {}", e))?;
            let _ = write_txn
                .open_table(SNIPPETS_TABLE)
                .map_err(|e| format!("Failed to open snippets table: {}", e))?;
            let _ = write_txn
                .open_table(LAUNCHER_TABLE)
                .map_err(|e| format!("Failed to open launcher table: {}", e))?;
            let _ = write_txn
                .open_table(KV_STORE_TABLE)
                .map_err(|e| format!("Failed to open kv table: {}", e))?;
        }
        write_txn
            .commit()
            .map_err(|e| format!("Failed to commit table creation: {}", e))?;

        *self.db.write() = Some(Arc::new(db));
        Ok(())
    }

    pub fn get_db(&self) -> Result<Arc<Database>, String> {
        self.db
            .read()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Database not initialized. Please configure data directory first.".to_string())
    }

    pub fn is_ready(&self) -> bool {
        self.db.read().is_some()
    }
}

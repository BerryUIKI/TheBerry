use super::comparator::Comparator;
use super::model::{
    CompareVariant, ComparisonItem, ComparisonManifest, DeletionVariant, PathFilter, SyncProfile,
    SyncProgressEvent, SyncResult, SyncVariant,
};
use super::scanner::Scanner;
use super::synchronizer::Synchronizer;
use super::watcher::WatcherManager;
use crate::core::database::{DatabaseManager, SYNC_HISTORY_TABLE, SYNC_PROFILES_TABLE};
use parking_lot::Mutex;
use redb::ReadableTable;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
pub struct FolderSyncService {
    db_manager: Arc<DatabaseManager>,
    active_jobs: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    watcher_manager: Arc<WatcherManager>,
}

impl FolderSyncService {
    pub fn new(db_manager: Arc<DatabaseManager>) -> Self {
        Self {
            db_manager,
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
            watcher_manager: Arc::new(WatcherManager::new()),
        }
    }

    pub fn compare_folders(
        &self,
        left_path: &str,
        right_path: &str,
        compare_variant: CompareVariant,
        sync_variant: SyncVariant,
        filter: Option<PathFilter>,
    ) -> Result<ComparisonManifest, String> {
        let l_path = Path::new(left_path);
        let r_path = Path::new(right_path);

        if !l_path.exists() {
            return Err(format!("Left directory does not exist: {}", left_path));
        }
        if !r_path.exists() {
            return Err(format!("Right directory does not exist: {}", right_path));
        }

        let effective_filter = filter.unwrap_or_default();
        let compute_hash = compare_variant == CompareVariant::ContentHash;

        let left_files = Scanner::scan_directory(l_path, &effective_filter, compute_hash)
            .map_err(|e| format!("Scan error on left path: {}", e))?;
        let right_files = Scanner::scan_directory(r_path, &effective_filter, compute_hash)
            .map_err(|e| format!("Scan error on right path: {}", e))?;

        let manifest = Comparator::compare(&left_files, &right_files, compare_variant, sync_variant);
        Ok(manifest)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn execute_sync(
        &self,
        app_handle: AppHandle,
        job_id: String,
        left_path: String,
        right_path: String,
        items: Vec<ComparisonItem>,
        deletion_variant: DeletionVariant,
        versioning_dir: Option<String>,
    ) -> Result<SyncResult, String> {
        let cancel_flag = Arc::new(AtomicBool::new(false));
        self.active_jobs
            .lock()
            .insert(job_id.clone(), cancel_flag.clone());

        let l_path = PathBuf::from(&left_path);
        let r_path = PathBuf::from(&right_path);
        let v_path = versioning_dir.as_ref().map(PathBuf::from);

        let app_clone = app_handle.clone();
        let result = Synchronizer::execute_sync(
            &job_id,
            &l_path,
            &r_path,
            &items,
            deletion_variant,
            v_path.as_deref(),
            cancel_flag,
            move |progress: SyncProgressEvent| {
                let _ = app_clone.emit("folder-sync-progress", progress);
            },
        );

        // Remove from active jobs
        self.active_jobs.lock().remove(&job_id);

        // Save history to redb
        let _ = self.save_history(&result);

        Ok(result)
    }

    pub fn cancel_sync(&self, job_id: &str) -> bool {
        if let Some(cancel_flag) = self.active_jobs.lock().get(job_id) {
            cancel_flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    // --- Profile Management in redb ---

    pub fn get_profiles(&self) -> Result<Vec<SyncProfile>, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db
            .begin_read()
            .map_err(|e| format!("Failed to begin read txn: {}", e))?;
        let table = read_txn
            .open_table(SYNC_PROFILES_TABLE)
            .map_err(|e| format!("Failed to open sync_profiles table: {}", e))?;

        let mut profiles = Vec::new();
        let iter = table
            .iter()
            .map_err(|e| format!("Failed to iterate sync_profiles: {}", e))?;

        for (_k, v) in iter.flatten() {
            if let Ok(prof) = serde_json::from_slice::<SyncProfile>(v.value()) {
                profiles.push(prof);
            }
        }

        profiles.sort_by_key(|b| std::cmp::Reverse(b.updated_at));
        Ok(profiles)
    }

    pub fn save_profile(&self, mut profile: SyncProfile) -> Result<SyncProfile, String> {
        let db = self.db_manager.get_db()?;
        let _guard = self.db_manager.write_lock();
        profile.updated_at = chrono::Utc::now().timestamp();

        let bytes = serde_json::to_vec(&profile).map_err(|e| format!("Serialization error: {}", e))?;

        let write_txn = db
            .begin_write()
            .map_err(|e| format!("Failed to begin write txn: {}", e))?;
        {
            let mut table = write_txn
                .open_table(SYNC_PROFILES_TABLE)
                .map_err(|e| format!("Failed to open sync_profiles table: {}", e))?;
            table
                .insert(profile.id.as_str(), bytes.as_slice())
                .map_err(|e| format!("Failed to insert profile: {}", e))?;
        }
        write_txn
            .commit()
            .map_err(|e| format!("Failed to commit profile: {}", e))?;

        Ok(profile)
    }

    pub fn delete_profile(&self, profile_id: &str) -> Result<bool, String> {
        self.watcher_manager.stop_watcher(profile_id);

        let db = self.db_manager.get_db()?;
        let _guard = self.db_manager.write_lock();

        let write_txn = db
            .begin_write()
            .map_err(|e| format!("Failed to begin write txn: {}", e))?;
        let deleted = {
            let mut table = write_txn
                .open_table(SYNC_PROFILES_TABLE)
                .map_err(|e| format!("Failed to open sync_profiles table: {}", e))?;
            let res = table
                .remove(profile_id)
                .map_err(|e| format!("Failed to remove profile: {}", e))?;
            res.is_some()
        };
        write_txn
            .commit()
            .map_err(|e| format!("Failed to commit profile deletion: {}", e))?;

        Ok(deleted)
    }

    // --- RealTimeSync Watcher Management ---

    pub fn toggle_realtime(
        &self,
        app_handle: AppHandle,
        profile_id: &str,
        enabled: bool,
    ) -> Result<bool, String> {
        let profiles = self.get_profiles()?;
        let profile = profiles
            .into_iter()
            .find(|p| p.id == profile_id)
            .ok_or_else(|| format!("Profile not found: {}", profile_id))?;

        if enabled {
            let pid = profile.id.clone();
            let app_clone = app_handle.clone();
            let watch_path = PathBuf::from(&profile.left_path);
            let debounce = profile.realtime_debounce_secs;

            self.watcher_manager.start_watcher(
                pid.clone(),
                watch_path,
                debounce,
                move |id| {
                    let _ = app_clone.emit("folder-sync-realtime-triggered", id);
                },
            )?;

            // Update profile realtime_enabled state
            let mut updated_profile = profile;
            updated_profile.realtime_enabled = true;
            self.save_profile(updated_profile)?;
            Ok(true)
        } else {
            self.watcher_manager.stop_watcher(profile_id);
            let mut updated_profile = profile;
            updated_profile.realtime_enabled = false;
            self.save_profile(updated_profile)?;
            Ok(false)
        }
    }

    pub fn is_realtime_active(&self, profile_id: &str) -> bool {
        self.watcher_manager.is_watching(profile_id)
    }

    // --- History in redb ---

    fn save_history(&self, result: &SyncResult) -> Result<(), String> {
        let db = self.db_manager.get_db()?;
        let _guard = self.db_manager.write_lock();

        let bytes = serde_json::to_vec(result).map_err(|e| format!("Serialization error: {}", e))?;
        let write_txn = db
            .begin_write()
            .map_err(|e| format!("Failed to begin write txn: {}", e))?;
        {
            let mut table = write_txn
                .open_table(SYNC_HISTORY_TABLE)
                .map_err(|e| format!("Failed to open sync_history table: {}", e))?;
            table
                .insert(result.job_id.as_str(), bytes.as_slice())
                .map_err(|e| format!("Failed to insert sync history: {}", e))?;
        }
        write_txn
            .commit()
            .map_err(|e| format!("Failed to commit sync history: {}", e))?;

        Ok(())
    }

    pub fn get_history(&self, limit: usize) -> Result<Vec<SyncResult>, String> {
        let db = self.db_manager.get_db()?;
        let read_txn = db
            .begin_read()
            .map_err(|e| format!("Failed to begin read txn: {}", e))?;
        let table = read_txn
            .open_table(SYNC_HISTORY_TABLE)
            .map_err(|e| format!("Failed to open sync_history table: {}", e))?;

        let mut list = Vec::new();
        let iter = table
            .iter()
            .map_err(|e| format!("Failed to iterate sync_history: {}", e))?;

        for (_k, v) in iter.flatten() {
            if let Ok(res) = serde_json::from_slice::<SyncResult>(v.value()) {
                list.push(res);
            }
        }

        // Limit results
        list.reverse();
        if list.len() > limit {
            list.truncate(limit);
        }
        Ok(list)
    }
}

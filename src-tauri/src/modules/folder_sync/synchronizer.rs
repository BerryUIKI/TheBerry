use super::model::{
    ComparisonItem, DeletionVariant, SyncAction, SyncLogEntry, SyncProgressEvent, SyncResult,
};
use chrono::Utc;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

pub struct Synchronizer;

impl Synchronizer {
    pub fn execute_sync<F>(
        job_id: &str,
        left_root: &Path,
        right_root: &Path,
        items: &[ComparisonItem],
        deletion_variant: DeletionVariant,
        versioning_dir: Option<&Path>,
        cancel_flag: Arc<AtomicBool>,
        mut progress_cb: F,
    ) -> SyncResult
    where
        F: FnMut(SyncProgressEvent),
    {
        let start_time = Instant::now();
        let mut files_copied = 0;
        let mut files_deleted = 0;
        let mut bytes_transferred = 0u64;
        let mut errors = Vec::new();
        let mut logs = Vec::new();

        // Calculate total items and total bytes to process
        let mut total_items = 0;
        let mut total_bytes = 0u64;
        for item in items {
            match item.action {
                SyncAction::CopyLeftToRight => {
                    total_items += 1;
                    if let Some(left) = &item.left {
                        total_bytes += left.size_bytes;
                    }
                }
                SyncAction::CopyRightToLeft => {
                    total_items += 1;
                    if let Some(right) = &item.right {
                        total_bytes += right.size_bytes;
                    }
                }
                SyncAction::DeleteLeft | SyncAction::DeleteRight => {
                    total_items += 1;
                }
                _ => {}
            }
        }

        let timestamp_str = Utc::now().format("%Y-%m-%d_%H%M%S").to_string();
        let version_subfolder = versioning_dir.map(|vd| vd.join(&timestamp_str));

        let mut items_processed = 0;
        let mut last_emit = Instant::now();

        // Initial progress emit
        progress_cb(SyncProgressEvent {
            job_id: job_id.to_string(),
            current_file: "".to_string(),
            items_processed: 0,
            total_items,
            bytes_processed: 0,
            total_bytes,
            speed_bytes_per_sec: 0,
            stage: "syncing".to_string(),
            message: "Starting file synchronization".to_string(),
        });

        for item in items {
            if cancel_flag.load(Ordering::Relaxed) {
                logs.push(SyncLogEntry {
                    timestamp: Utc::now().timestamp(),
                    level: "warn".to_string(),
                    message: "Sync operation cancelled by user".to_string(),
                });
                break;
            }

            match item.action {
                SyncAction::CopyLeftToRight => {
                    let src = left_root.join(&item.relative_path);
                    let dst = right_root.join(&item.relative_path);

                    // If destination exists, archive or delete first
                    if dst.exists() {
                        if let Err(e) = Self::handle_deletion(
                            &dst,
                            &item.relative_path,
                            deletion_variant,
                            version_subfolder.as_deref(),
                        ) {
                            let msg = format!("Failed to remove/archive destination {}: {}", dst.display(), e);
                            tracing::error!("{}", msg);
                            errors.push(msg.clone());
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "error".to_string(),
                                message: msg,
                            });
                        }
                    }

                    match Self::copy_file_with_metadata(&src, &dst) {
                        Ok(copied) => {
                            files_copied += 1;
                            bytes_transferred += copied;
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "info".to_string(),
                                message: format!("Copied (L -> R): {}", item.relative_path),
                            });
                        }
                        Err(e) => {
                            let msg = format!("Failed to copy {} -> {}: {}", src.display(), dst.display(), e);
                            tracing::error!("{}", msg);
                            errors.push(msg.clone());
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "error".to_string(),
                                message: msg,
                            });
                        }
                    }
                    items_processed += 1;
                }
                SyncAction::CopyRightToLeft => {
                    let src = right_root.join(&item.relative_path);
                    let dst = left_root.join(&item.relative_path);

                    if dst.exists() {
                        if let Err(e) = Self::handle_deletion(
                            &dst,
                            &item.relative_path,
                            deletion_variant,
                            version_subfolder.as_deref(),
                        ) {
                            let msg = format!("Failed to remove/archive destination {}: {}", dst.display(), e);
                            tracing::error!("{}", msg);
                            errors.push(msg.clone());
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "error".to_string(),
                                message: msg,
                            });
                        }
                    }

                    match Self::copy_file_with_metadata(&src, &dst) {
                        Ok(copied) => {
                            files_copied += 1;
                            bytes_transferred += copied;
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "info".to_string(),
                                message: format!("Copied (R -> L): {}", item.relative_path),
                            });
                        }
                        Err(e) => {
                            let msg = format!("Failed to copy {} -> {}: {}", src.display(), dst.display(), e);
                            tracing::error!("{}", msg);
                            errors.push(msg.clone());
                            logs.push(SyncLogEntry {
                                timestamp: Utc::now().timestamp(),
                                level: "error".to_string(),
                                message: msg,
                            });
                        }
                    }
                    items_processed += 1;
                }
                SyncAction::DeleteRight => {
                    let target = right_root.join(&item.relative_path);
                    if target.exists() {
                        match Self::handle_deletion(
                            &target,
                            &item.relative_path,
                            deletion_variant,
                            version_subfolder.as_deref(),
                        ) {
                            Ok(_) => {
                                files_deleted += 1;
                                logs.push(SyncLogEntry {
                                    timestamp: Utc::now().timestamp(),
                                    level: "info".to_string(),
                                    message: format!("Deleted Right: {}", item.relative_path),
                                });
                            }
                            Err(e) => {
                                let msg = format!("Failed to delete {}: {}", target.display(), e);
                                tracing::error!("{}", msg);
                                errors.push(msg.clone());
                                logs.push(SyncLogEntry {
                                    timestamp: Utc::now().timestamp(),
                                    level: "error".to_string(),
                                    message: msg,
                                });
                            }
                        }
                    }
                    items_processed += 1;
                }
                SyncAction::DeleteLeft => {
                    let target = left_root.join(&item.relative_path);
                    if target.exists() {
                        match Self::handle_deletion(
                            &target,
                            &item.relative_path,
                            deletion_variant,
                            version_subfolder.as_deref(),
                        ) {
                            Ok(_) => {
                                files_deleted += 1;
                                logs.push(SyncLogEntry {
                                    timestamp: Utc::now().timestamp(),
                                    level: "info".to_string(),
                                    message: format!("Deleted Left: {}", item.relative_path),
                                });
                            }
                            Err(e) => {
                                let msg = format!("Failed to delete {}: {}", target.display(), e);
                                tracing::error!("{}", msg);
                                errors.push(msg.clone());
                                logs.push(SyncLogEntry {
                                    timestamp: Utc::now().timestamp(),
                                    level: "error".to_string(),
                                    message: msg,
                                });
                            }
                        }
                    }
                    items_processed += 1;
                }
                SyncAction::DoNothing | SyncAction::Conflict => {}
            }

            // Emit throttled progress update (at least every 100ms or on completion)
            if last_emit.elapsed().as_millis() >= 100 || items_processed == total_items {
                let elapsed_secs = start_time.elapsed().as_secs_f64();
                let speed = if elapsed_secs > 0.0 {
                    (bytes_transferred as f64 / elapsed_secs) as u64
                } else {
                    0
                };

                progress_cb(SyncProgressEvent {
                    job_id: job_id.to_string(),
                    current_file: item.relative_path.clone(),
                    items_processed,
                    total_items,
                    bytes_processed: bytes_transferred,
                    total_bytes,
                    speed_bytes_per_sec: speed,
                    stage: if items_processed >= total_items {
                        "completed".to_string()
                    } else {
                        "syncing".to_string()
                    },
                    message: format!("Processing {}", item.relative_path),
                });
                last_emit = Instant::now();
            }
        }

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let is_canceled = cancel_flag.load(Ordering::Relaxed);
        let success = errors.is_empty() && !is_canceled;

        progress_cb(SyncProgressEvent {
            job_id: job_id.to_string(),
            current_file: "".to_string(),
            items_processed,
            total_items,
            bytes_processed: bytes_transferred,
            total_bytes,
            speed_bytes_per_sec: 0,
            stage: if is_canceled {
                "canceled".to_string()
            } else if success {
                "completed".to_string()
            } else {
                "failed".to_string()
            },
            message: if is_canceled {
                "Sync canceled".to_string()
            } else if success {
                "Sync completed successfully".to_string()
            } else {
                format!("Sync completed with {} errors", errors.len())
            },
        });

        SyncResult {
            job_id: job_id.to_string(),
            success,
            files_copied,
            files_deleted,
            bytes_transferred,
            duration_ms,
            errors,
            logs,
        }
    }

    fn copy_file_with_metadata(src: &Path, dst: &Path) -> Result<u64, String> {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        let mut src_file = File::open(src).map_err(|e| format!("Failed to open source file: {}", e))?;
        let mut dst_file = File::create(dst).map_err(|e| format!("Failed to create destination file: {}", e))?;

        let mut buffer = [0u8; 128 * 1024];
        let mut total = 0u64;

        loop {
            let n = src_file.read(&mut buffer).map_err(|e| format!("Read error: {}", e))?;
            if n == 0 {
                break;
            }
            dst_file.write_all(&buffer[..n]).map_err(|e| format!("Write error: {}", e))?;
            total += n as u64;
        }

        dst_file.flush().map_err(|e| format!("Flush error: {}", e))?;

        // Preserve modification time
        if let Ok(meta) = src.metadata() {
            if let Ok(mtime) = meta.modified() {
                let ft = filetime::FileTime::from_system_time(mtime);
                let _ = filetime::set_file_mtime(dst, ft);
            }
        }

        Ok(total)
    }

    fn handle_deletion(
        path: &Path,
        rel_path: &str,
        deletion_variant: DeletionVariant,
        versioning_subfolder: Option<&Path>,
    ) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }

        match deletion_variant {
            DeletionVariant::Permanent => {
                if path.is_dir() {
                    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {}", e))
                } else {
                    fs::remove_file(path).map_err(|e| format!("Failed to remove file: {}", e))
                }
            }
            DeletionVariant::RecycleBin => {
                trash::delete(path).map_err(|e| format!("Failed to move {} to recycle bin: {}", path.display(), e))
            }
            DeletionVariant::Versioning => {
                if let Some(v_root) = versioning_subfolder {
                    let backup_dst = v_root.join(rel_path);
                    if let Some(parent) = backup_dst.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    if path.is_dir() {
                        let _ = fs::create_dir_all(&backup_dst);
                        fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {}", e))
                    } else {
                        // Move file to versioning destination
                        if let Err(_) = fs::rename(path, &backup_dst) {
                            // Fallback to copy + remove
                            fs::copy(path, &backup_dst).map_err(|e| format!("Failed to backup version: {}", e))?;
                            fs::remove_file(path).map_err(|e| format!("Failed to remove original file: {}", e))?;
                        }
                        Ok(())
                    }
                } else {
                    // Fallback to recycle bin if no versioning directory specified
                    trash::delete(path).map_err(|e| format!("Failed to move to recycle bin: {}", e))
                }
            }
        }
    }
}

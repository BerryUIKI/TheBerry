use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::{DateTime, Utc};
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use redb::ReadableTable;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::core::database::{DatabaseManager, CLIPBOARD_TABLE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: String, // "text" | "image" | "file"
    pub content: String,
    pub preview: String,
    pub media_path: Option<String>,
    pub media_data_url: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
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
            media_path: None,
            media_data_url: None,
            image_width: None,
            image_height: None,
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

    pub fn add_image_item(
        &self,
        width: usize,
        height: usize,
        rgba_bytes: &[u8],
        data_dir: Option<&Path>,
    ) -> Result<ClipboardItem, String> {
        if width == 0 || height == 0 || rgba_bytes.is_empty() {
            return Err("Invalid image dimensions or empty buffer".to_string());
        }

        let id = Uuid::new_v4().to_string();

        // Convert raw RGBA buffer to image
        let img_buffer: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_raw(width as u32, height as u32, rgba_bytes.to_vec())
                .ok_or_else(|| "Failed to construct ImageBuffer from raw RGBA bytes".to_string())?;
        let dynamic_img = DynamicImage::ImageRgba8(img_buffer);

        // Optionally persist image PNG to <data_dir>/media/
        let media_path = if let Some(root) = data_dir {
            let media_dir = root.join("media");
            let _ = std::fs::create_dir_all(&media_dir);
            let file_path = media_dir.join(format!("clip_{}.png", id));
            let _ = dynamic_img.save_with_format(&file_path, ImageFormat::Png);
            Some(file_path.to_string_lossy().to_string())
        } else {
            None
        };

        // Create base64 thumbnail data URL for fast frontend rendering (resize if large)
        let thumbnail = if width > 320 || height > 240 {
            dynamic_img.thumbnail(320, 240)
        } else {
            dynamic_img.clone()
        };

        let mut png_bytes: Vec<u8> = Vec::new();
        let _ = thumbnail.write_to(&mut Cursor::new(&mut png_bytes), ImageFormat::Png);
        let data_url = format!("data:image/png;base64,{}", BASE64.encode(&png_bytes));

        let item = ClipboardItem {
            id,
            content_type: "image".to_string(),
            content: format!("[Image {}x{}]", width, height),
            preview: format!("Image ({}x{} px)", width, height),
            media_path,
            media_data_url: Some(data_url),
            image_width: Some(width as u32),
            image_height: Some(height as u32),
            is_pinned: false,
            char_count: 0,
            created_at: Utc::now(),
        };

        let db = self.db_manager.get_db()?;
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

    pub fn copy_image_to_clipboard(image_path: &str) -> Result<(), String> {
        let path = PathBuf::from(image_path);
        if !path.exists() {
            return Err("Image file does not exist".to_string());
        }

        let img = image::open(&path)
            .map_err(|e| format!("Failed to load image: {}", e))?
            .to_rgba8();

        let (width, height) = img.dimensions();
        let raw_pixels = img.into_raw();

        let image_data = arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: Cow::Owned(raw_pixels),
        };

        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| format!("Failed to open clipboard: {}", e))?;
        clipboard
            .set_image(image_data)
            .map_err(|e| format!("Failed to copy image to clipboard: {}", e))?;

        Ok(())
    }

    /// Background listener daemon that monitors OS clipboard changes for text and images
    pub fn start_listener(db_manager: Arc<DatabaseManager>, app_handle: AppHandle) {
        std::thread::Builder::new()
            .name("clipboard-daemon".to_string())
            .spawn(move || {
                let mut last_text = String::new();
                let mut last_img_hash: u64 = 0;
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
                        // 1. Check for text updates
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

                        // 2. Check for image updates
                        if let Ok(img_data) = clip.get_image() {
                            let w = img_data.width;
                            let h = img_data.height;
                            if w > 0 && h > 0 && !img_data.bytes.is_empty() {
                                // Fast lightweight hash of image header and middle bytes
                                let sample_len = img_data.bytes.len().min(1024);
                                let mut hash: u64 = (w as u64) ^ ((h as u64) << 16) ^ (img_data.bytes.len() as u64);
                                for b in &img_data.bytes[..sample_len] {
                                    hash = hash.wrapping_mul(31).wrapping_add(*b as u64);
                                }

                                if hash != last_img_hash {
                                    last_img_hash = hash;
                                    let service = ClipboardService::new(db_manager.clone());
                                    let root_dir = crate::core::config::ConfigManager::new().get_data_dir();
                                    if let Ok(item) = service.add_image_item(
                                        w,
                                        h,
                                        &img_data.bytes,
                                        root_dir.as_deref(),
                                    ) {
                                        let _ = app_handle.emit("clipboard-updated", item);
                                    }
                                }
                            }
                        }
                    }
                }
            })
            .expect("Failed to spawn clipboard listener thread");
    }
}

use image::imageops::FilterType;
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertTask {
    pub source_path: String,
    pub target_format: String, // "webp" | "jpeg" | "png"
    pub quality: u8,           // 1-100
    pub output_dir: Option<String>,
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    pub preserve_aspect_ratio: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertResult {
    pub source_path: String,
    pub target_path: String,
    pub original_size_bytes: u64,
    pub converted_size_bytes: u64,
    pub success: bool,
    pub error_message: Option<String>,
    pub width: u32,
    pub height: u32,
}

pub const MAX_IMAGE_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100 MB
pub const MAX_IMAGE_DIMENSION: u32 = 16384;
pub const MAX_TOTAL_PIXELS: u64 = 100_000_000; // 100 MP

pub struct ImageConverterService;

impl ImageConverterService {
    fn decode_image_file(source_path: &Path) -> Result<image::DynamicImage, String> {
        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "heic" || ext == "heif" || ext == "hif" {
            let bytes = fs::read(source_path)
                .map_err(|e| format!("Failed to read HEIC file: {}", e))?;
            let decoded = heic::DecoderConfig::new()
                .decode(&bytes, heic::PixelLayout::Rgba8)
                .map_err(|e| format!("Failed to decode HEIC image: {}", e))?;
            let buffer = image::RgbaImage::from_raw(decoded.width, decoded.height, decoded.data)
                .ok_or_else(|| "Failed to construct RGBA image buffer from decoded HEIC data".to_string())?;
            Ok(image::DynamicImage::ImageRgba8(buffer))
        } else {
            match image::open(source_path) {
                Ok(img) => Ok(img),
                Err(orig_err) => {
                    // Fallback: try HEIC decoder in case image is HEIC with unexpected extension
                    if let Ok(bytes) = fs::read(source_path) {
                        if let Ok(decoded) = heic::DecoderConfig::new().decode(&bytes, heic::PixelLayout::Rgba8) {
                            if let Some(buffer) = image::RgbaImage::from_raw(decoded.width, decoded.height, decoded.data) {
                                return Ok(image::DynamicImage::ImageRgba8(buffer));
                            }
                        }
                    }
                    Err(format!("Failed to decode image: {}", orig_err))
                }
            }
        }
    }

    pub fn convert_single(task: ConvertTask) -> ConvertResult {
        let source_path = PathBuf::from(&task.source_path);
        if !source_path.exists() {
            return ConvertResult {
                source_path: task.source_path,
                target_path: String::new(),
                original_size_bytes: 0,
                converted_size_bytes: 0,
                success: false,
                error_message: Some("Source file not found".to_string()),
                width: 0,
                height: 0,
            };
        }

        let original_size = fs::metadata(&source_path).map(|m| m.len()).unwrap_or(0);
        if original_size > MAX_IMAGE_FILE_SIZE {
            return ConvertResult {
                source_path: task.source_path,
                target_path: String::new(),
                original_size_bytes: original_size,
                converted_size_bytes: 0,
                success: false,
                error_message: Some(format!(
                    "Image file size ({} MB) exceeds maximum allowed limit of 100 MB",
                    original_size / (1024 * 1024)
                )),
                width: 0,
                height: 0,
            };
        }

        let mut dynamic_img = match Self::decode_image_file(&source_path) {
            Ok(img) => img,
            Err(e) => {
                return ConvertResult {
                    source_path: task.source_path,
                    target_path: String::new(),
                    original_size_bytes: original_size,
                    converted_size_bytes: 0,
                    success: false,
                    error_message: Some(e),
                    width: 0,
                    height: 0,
                };
            }
        };

        let (orig_w, orig_h) = (dynamic_img.width(), dynamic_img.height());
        if orig_w > MAX_IMAGE_DIMENSION || orig_h > MAX_IMAGE_DIMENSION || (orig_w as u64 * orig_h as u64) > MAX_TOTAL_PIXELS {
            return ConvertResult {
                source_path: task.source_path,
                target_path: String::new(),
                original_size_bytes: original_size,
                converted_size_bytes: 0,
                success: false,
                error_message: Some(format!(
                    "Image dimensions ({}x{}) exceed maximum safety limits",
                    orig_w, orig_h
                )),
                width: orig_w,
                height: orig_h,
            };
        }

        // Apply Resizing if requested
        if let (Some(w), Some(h)) = (task.resize_width, task.resize_height) {
            if w > 0 && h > 0 {
                if task.preserve_aspect_ratio.unwrap_or(true) {
                    dynamic_img = dynamic_img.resize(w, h, FilterType::Lanczos3);
                } else {
                    dynamic_img = dynamic_img.resize_exact(w, h, FilterType::Lanczos3);
                }
            }
        } else if let Some(w) = task.resize_width {
            if w > 0 {
                let current_w = dynamic_img.width();
                let current_h = dynamic_img.height();
                let scale = w as f32 / current_w as f32;
                let target_h = (current_h as f32 * scale).round() as u32;
                dynamic_img = dynamic_img.resize_exact(w, target_h.max(1), FilterType::Lanczos3);
            }
        } else if let Some(h) = task.resize_height {
            if h > 0 {
                let current_w = dynamic_img.width();
                let current_h = dynamic_img.height();
                let scale = h as f32 / current_h as f32;
                let target_w = (current_w as f32 * scale).round() as u32;
                dynamic_img = dynamic_img.resize_exact(target_w.max(1), h, FilterType::Lanczos3);
            }
        }

        let (final_w, final_h) = (dynamic_img.width(), dynamic_img.height());

        // Determine destination file path
        let stem = source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");

        let ext = match task.target_format.to_lowercase().as_str() {
            "webp" => "webp",
            "jpeg" | "jpg" => "jpg",
            "png" => "png",
            _ => "webp",
        };

        let target_dir = match &task.output_dir {
            Some(d) => PathBuf::from(d),
            None => source_path
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf(),
        };

        if let Err(e) = fs::create_dir_all(&target_dir) {
            return ConvertResult {
                source_path: task.source_path,
                target_path: String::new(),
                original_size_bytes: original_size,
                converted_size_bytes: 0,
                success: false,
                error_message: Some(format!("Failed to create output directory: {}", e)),
                width: 0,
                height: 0,
            };
        }

        let target_path = target_dir.join(format!("{}_converted.{}", stem, ext));

        let format = match ext {
            "webp" => ImageFormat::WebP,
            "jpg" => ImageFormat::Jpeg,
            "png" => ImageFormat::Png,
            _ => ImageFormat::WebP,
        };

        let save_result = match format {
            ImageFormat::Jpeg => {
                let rgb_img = dynamic_img.to_rgb8();
                let mut file = match fs::File::create(&target_path) {
                    Ok(f) => f,
                    Err(e) => return ConvertResult {
                        source_path: task.source_path,
                        target_path: target_path.to_string_lossy().to_string(),
                        original_size_bytes: original_size,
                        converted_size_bytes: 0,
                        success: false,
                        error_message: Some(format!("Failed to create destination file: {}", e)),
                        width: final_w,
                        height: final_h,
                    },
                };
                let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut file, task.quality.clamp(1, 100));
                encoder.encode(rgb_img.as_raw(), rgb_img.width(), rgb_img.height(), image::ExtendedColorType::Rgb8)
                    .map_err(|e| e.to_string())
            }
            ImageFormat::WebP => {
                let rgba = dynamic_img.to_rgba8();
                let mut file = match fs::File::create(&target_path) {
                    Ok(f) => f,
                    Err(e) => return ConvertResult {
                        source_path: task.source_path,
                        target_path: target_path.to_string_lossy().to_string(),
                        original_size_bytes: original_size,
                        converted_size_bytes: 0,
                        success: false,
                        error_message: Some(format!("Failed to create destination file: {}", e)),
                        width: final_w,
                        height: final_h,
                    },
                };
                let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut file);
                encoder.encode(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
                    .map_err(|e| e.to_string())
            }
            _ => dynamic_img.save_with_format(&target_path, format).map_err(|e| e.to_string()),
        };

        match save_result {
            Ok(_) => {
                let converted_size = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);
                ConvertResult {
                    source_path: task.source_path,
                    target_path: target_path.to_string_lossy().to_string(),
                    original_size_bytes: original_size,
                    converted_size_bytes: converted_size,
                    success: true,
                    error_message: None,
                    width: final_w,
                    height: final_h,
                }
            }
            Err(e) => ConvertResult {
                source_path: task.source_path,
                target_path: target_path.to_string_lossy().to_string(),
                original_size_bytes: original_size,
                converted_size_bytes: 0,
                success: false,
                error_message: Some(e),
                width: final_w,
                height: final_h,
            },
        }
    }

    pub fn convert_batch(tasks: Vec<ConvertTask>) -> Vec<ConvertResult> {
        tasks.into_iter().map(Self::convert_single).collect()
    }

    pub fn is_supported_image_file(path: &Path) -> bool {
        if !path.is_file() {
            return false;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "bmp" | "tiff" | "tif" | "heic" | "heif" | "hif"
        )
    }

    pub fn scan_image_paths(paths: Vec<String>, recursive: bool) -> Vec<String> {
        let mut results = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for path_str in paths {
            let path = Path::new(&path_str);
            if !path.exists() {
                continue;
            }

            if path.is_file() {
                if Self::is_supported_image_file(path) {
                    let canon = path.to_string_lossy().to_string();
                    if seen.insert(canon.clone()) {
                        results.push(canon);
                    }
                }
            } else if path.is_dir() {
                if recursive {
                    for entry in walkdir::WalkDir::new(path).follow_links(true).into_iter().filter_map(|e| e.ok()) {
                        let sub_path = entry.path();
                        if Self::is_supported_image_file(sub_path) {
                            let canon = sub_path.to_string_lossy().to_string();
                            if seen.insert(canon.clone()) {
                                results.push(canon);
                            }
                        }
                    }
                } else if let Ok(entries) = fs::read_dir(path) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let sub_path = entry.path();
                        if Self::is_supported_image_file(&sub_path) {
                            let canon = sub_path.to_string_lossy().to_string();
                            if seen.insert(canon.clone()) {
                                results.push(canon);
                            }
                        }
                    }
                }
            }
        }

        results
    }
}

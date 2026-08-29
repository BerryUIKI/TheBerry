use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub struct ConvertTask {
    pub source_path: String,
    pub target_format: String, // "png" | "jpeg" | "webp"
    pub quality: Option<u8>,   // 1 - 100
    pub output_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConvertResult {
    pub source_path: String,
    pub output_path: Option<String>,
    pub original_size_bytes: u64,
    pub converted_size_bytes: Option<u64>,
    pub success: bool,
    pub error_message: Option<String>,
}

pub struct ImageConverterService;

impl ImageConverterService {
    pub fn convert_single(task: &ConvertTask) -> ConvertResult {
        let src_path = Path::new(&task.source_path);
        let orig_size = std::fs::metadata(src_path).map(|m| m.len()).unwrap_or(0);

        if !src_path.exists() {
            return ConvertResult {
                source_path: task.source_path.clone(),
                output_path: None,
                original_size_bytes: orig_size,
                converted_size_bytes: None,
                success: false,
                error_message: Some("Source file does not exist".to_string()),
            };
        }

        let out_dir = if let Some(ref dir) = task.output_dir {
            PathBuf::from(dir)
        } else {
            src_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
        };

        let file_stem = src_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");

        let format_lower = task.target_format.to_lowercase();
        let target_ext = match format_lower.as_str() {
            "jpeg" | "jpg" => "jpg",
            "webp" => "webp",
            "png" => "png",
            other => other,
        };

        let out_filename = format!("{}_converted.{}", file_stem, target_ext);
        let out_path = out_dir.join(out_filename);

        match image::open(src_path) {
            Ok(img) => {
                let format = match target_ext {
                    "jpg" => ImageFormat::Jpeg,
                    "webp" => ImageFormat::WebP,
                    _ => ImageFormat::Png,
                };

                let mut out_file = match File::create(&out_path) {
                    Ok(f) => f,
                    Err(e) => {
                        return ConvertResult {
                            source_path: task.source_path.clone(),
                            output_path: None,
                            original_size_bytes: orig_size,
                            converted_size_bytes: None,
                            success: false,
                            error_message: Some(format!("Failed to create destination file: {}", e)),
                        }
                    }
                };

                if let Err(e) = img.write_to(&mut out_file, format) {
                    return ConvertResult {
                        source_path: task.source_path.clone(),
                        output_path: None,
                        original_size_bytes: orig_size,
                        converted_size_bytes: None,
                        success: false,
                        error_message: Some(format!("Failed to encode image: {}", e)),
                    };
                }

                let new_size = std::fs::metadata(&out_path).map(|m| m.len()).unwrap_or(0);
                ConvertResult {
                    source_path: task.source_path.clone(),
                    output_path: Some(out_path.to_string_lossy().to_string()),
                    original_size_bytes: orig_size,
                    converted_size_bytes: Some(new_size),
                    success: true,
                    error_message: None,
                }
            }
            Err(e) => ConvertResult {
                source_path: task.source_path.clone(),
                output_path: None,
                original_size_bytes: orig_size,
                converted_size_bytes: None,
                success: false,
                error_message: Some(format!("Failed to decode source image: {}", e)),
            },
        }
    }

    pub fn convert_batch(tasks: Vec<ConvertTask>) -> Vec<ConvertResult> {
        tasks.iter().map(Self::convert_single).collect()
    }
}

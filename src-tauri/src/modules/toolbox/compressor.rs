use crate::modules::image_converter::service::ImageConverterService;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressTask {
    pub source_path: String,
    pub quality: u8, // 1-100
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub output_dir: Option<String>,
    pub output_format: Option<String>, // "original" | "webp" | "jpeg" | "png"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressResult {
    pub source_path: String,
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub saved_percentage: f64,
    pub success: bool,
    pub error_message: Option<String>,
}

pub struct ImageCompressorService;

impl ImageCompressorService {
    pub fn compress_single(task: &CompressTask) -> CompressResult {
        let source = Path::new(&task.source_path);
        let orig_size = fs::metadata(source).map(|m| m.len()).unwrap_or(0);

        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();

        let target_format = match task.output_format.as_deref() {
            Some("webp") => "webp".to_string(),
            Some("jpeg") | Some("jpg") => "jpeg".to_string(),
            Some("png") => "png".to_string(),
            _ => {
                if ext == "png" {
                    "png".to_string()
                } else if ext == "webp" {
                    "webp".to_string()
                } else {
                    "jpeg".to_string()
                }
            }
        };

        // Delegate to existing high-performance ImageConverterService
        let conv_task = crate::modules::image_converter::service::ConvertTask {
            source_path: task.source_path.clone(),
            target_format: target_format.clone(),
            quality: task.quality.clamp(1, 100),
            output_dir: task.output_dir.clone(),
            resize_width: task.max_width,
            resize_height: task.max_height,
            preserve_aspect_ratio: Some(true),
        };

        let res = ImageConverterService::convert_single(conv_task);
        if res.success {
            let comp_size = res.converted_size_bytes;
            let saved_pct = if orig_size > 0 && comp_size < orig_size {
                ((orig_size - comp_size) as f64 / orig_size as f64) * 100.0
            } else {
                0.0
            };

            CompressResult {
                source_path: task.source_path.clone(),
                output_path: res.target_path,
                original_size: orig_size,
                compressed_size: comp_size,
                saved_percentage: (saved_pct * 10.0).round() / 10.0,
                success: true,
                error_message: None,
            }
        } else {
            CompressResult {
                source_path: task.source_path.clone(),
                output_path: String::new(),
                original_size: orig_size,
                compressed_size: 0,
                saved_percentage: 0.0,
                success: false,
                error_message: res.error_message,
            }
        }
    }

    pub fn compress_batch(tasks: &[CompressTask]) -> Vec<CompressResult> {
        use rayon::prelude::*;
        tasks
            .par_iter()
            .map(|t| Self::compress_single(t))
            .collect()
    }
}

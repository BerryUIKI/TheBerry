use fast_image_resize::images::Image as FastImage;
use fast_image_resize::{FilterType as FastFilterType, PixelType, ResizeAlg, ResizeOptions, Resizer};
use image::ImageFormat;
use jpeg_encoder::{ColorType as JpegColorType, Encoder as JpegEncoder, SamplingFactor};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::BufWriter;
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
            // First attempt: use ImageReader with guessed format from magic header bytes
            // This natively supports .jfif and files with mismatched or unusual extensions
            let reader_res = image::ImageReader::open(source_path)
                .map_err(|e| e.to_string())
                .and_then(|r| r.with_guessed_format().map_err(|e| e.to_string()))
                .and_then(|r| r.decode().map_err(|e| e.to_string()));

            match reader_res {
                Ok(img) => Ok(img),
                Err(reader_err) => {
                    // Fallback 1: image::open (extension based)
                    if let Ok(img) = image::open(source_path) {
                        return Ok(img);
                    }
                    // Fallback 2: try HEIC decoder in case image is HEIC with unexpected extension
                    if let Ok(bytes) = fs::read(source_path) {
                        if let Ok(decoded) = heic::DecoderConfig::new().decode(&bytes, heic::PixelLayout::Rgba8) {
                            if let Some(buffer) = image::RgbaImage::from_raw(decoded.width, decoded.height, decoded.data) {
                                return Ok(image::DynamicImage::ImageRgba8(buffer));
                            }
                        }
                    }
                    Err(format!("Failed to decode image: {}", reader_err))
                }
            }
        }
    }

    fn fast_resize(
        img: &image::DynamicImage,
        target_w: u32,
        target_h: u32,
    ) -> Result<image::DynamicImage, String> {
        let (src_w, src_h) = (img.width(), img.height());
        if src_w == target_w && src_h == target_h {
            return Ok(img.clone());
        }

        let rgba_img = img.to_rgba8();
        let src_image = FastImage::from_vec_u8(
            src_w,
            src_h,
            rgba_img.into_raw(),
            PixelType::U8x4,
        )
        .map_err(|e| format!("Fast resize source creation error: {}", e))?;

        let mut dst_image = FastImage::new(target_w, target_h, PixelType::U8x4);
        let mut resizer = Resizer::new();
        let options = ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FastFilterType::Lanczos3));
        resizer
            .resize(&src_image, &mut dst_image, &options)
            .map_err(|e| format!("Fast resize execution error: {}", e))?;

        let out_rgba = image::RgbaImage::from_raw(target_w, target_h, dst_image.into_vec())
            .ok_or_else(|| "Failed to construct RGBA buffer after fast resize".to_string())?;

        Ok(image::DynamicImage::ImageRgba8(out_rgba))
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

        // Apply SIMD-accelerated Resizing if requested
        if let (Some(w), Some(h)) = (task.resize_width, task.resize_height) {
            if w > 0 && h > 0 {
                let (target_w, target_h) = if task.preserve_aspect_ratio.unwrap_or(true) {
                    let scale = (w as f32 / orig_w as f32).min(h as f32 / orig_h as f32);
                    ((orig_w as f32 * scale).round().max(1.0) as u32, (orig_h as f32 * scale).round().max(1.0) as u32)
                } else {
                    (w, h)
                };
                if let Ok(resized) = Self::fast_resize(&dynamic_img, target_w, target_h) {
                    dynamic_img = resized;
                }
            }
        } else if let Some(w) = task.resize_width {
            if w > 0 && w != orig_w {
                let scale = w as f32 / orig_w as f32;
                let target_h = (orig_h as f32 * scale).round().max(1.0) as u32;
                if let Ok(resized) = Self::fast_resize(&dynamic_img, w, target_h) {
                    dynamic_img = resized;
                }
            }
        } else if let Some(h) = task.resize_height {
            if h > 0 && h != orig_h {
                let scale = h as f32 / orig_h as f32;
                let target_w = (orig_w as f32 * scale).round().max(1.0) as u32;
                if let Ok(resized) = Self::fast_resize(&dynamic_img, target_w, h) {
                    dynamic_img = resized;
                }
            }
        }

        // Determine destination file path & format
        let stem = source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");

        let target_fmt = task.target_format.to_lowercase();
        let (ext, format) = match target_fmt.as_str() {
            "webp" => ("webp", ImageFormat::WebP),
            "jpeg" | "jpg" => ("jpg", ImageFormat::Jpeg),
            "jfif" => ("jfif", ImageFormat::Jpeg),
            "png" => ("png", ImageFormat::Png),
            "bmp" => ("bmp", ImageFormat::Bmp),
            "tiff" | "tif" => ("tiff", ImageFormat::Tiff),
            "gif" => ("gif", ImageFormat::Gif),
            "ico" => ("ico", ImageFormat::Ico),
            "tga" => ("tga", ImageFormat::Tga),
            "qoi" => ("qoi", ImageFormat::Qoi),
            _ => ("jpg", ImageFormat::Jpeg),
        };

        // For ICO output, clamp dimensions to 256x256 max to satisfy ICO specification
        if format == ImageFormat::Ico && (dynamic_img.width() > 256 || dynamic_img.height() > 256) {
            let (orig_w, orig_h) = (dynamic_img.width(), dynamic_img.height());
            let scale = (256.0 / orig_w as f32).min(256.0 / orig_h as f32);
            let ico_w = ((orig_w as f32 * scale).round() as u32).clamp(1, 256);
            let ico_h = ((orig_h as f32 * scale).round() as u32).clamp(1, 256);
            if let Ok(resized) = Self::fast_resize(&dynamic_img, ico_w, ico_h) {
                dynamic_img = resized;
            }
        }

        let (final_w, final_h) = (dynamic_img.width(), dynamic_img.height());

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

        let save_result = match format {
            ImageFormat::Jpeg => {
                let file = match fs::File::create(&target_path) {
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
                let mut writer = BufWriter::with_capacity(128 * 1024, file);
                let mut encoder = JpegEncoder::new(&mut writer, task.quality.clamp(1, 100));
                encoder.set_sampling_factor(SamplingFactor::R_4_2_0);
                let rgb_img = dynamic_img.to_rgb8();
                encoder.encode(
                    rgb_img.as_raw(),
                    final_w as u16,
                    final_h as u16,
                    JpegColorType::Rgb,
                )
                .map_err(|e| format!("JPEG encoding failed: {}", e))
                .and_then(|_| {
                    std::io::Write::flush(&mut writer)
                        .map_err(|e| format!("Failed to flush JPEG buffer: {}", e))
                })
            }
            ImageFormat::WebP => {
                let rgba = dynamic_img.to_rgba8();
                let file = match fs::File::create(&target_path) {
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
                let mut writer = BufWriter::with_capacity(128 * 1024, file);
                let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut writer);
                encoder.encode(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
                    .map_err(|e| e.to_string())
                    .and_then(|_| {
                        std::io::Write::flush(&mut writer)
                            .map_err(|e| format!("Failed to flush WebP buffer: {}", e))
                    })
            }
            _ => {
                let file = match fs::File::create(&target_path) {
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
                let mut writer = BufWriter::with_capacity(128 * 1024, file);
                dynamic_img.write_to(&mut writer, format).map_err(|e| e.to_string())
                    .and_then(|_| {
                        std::io::Write::flush(&mut writer)
                            .map_err(|e| format!("Failed to flush image buffer: {}", e))
                    })
            }
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
        tasks.into_par_iter().map(Self::convert_single).collect()
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
            "png"
                | "jpg"
                | "jpeg"
                | "jfif"
                | "jpe"
                | "jif"
                | "jfi"
                | "webp"
                | "bmp"
                | "dib"
                | "tiff"
                | "tif"
                | "gif"
                | "ico"
                | "tga"
                | "qoi"
                | "heic"
                | "heif"
                | "hif"
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

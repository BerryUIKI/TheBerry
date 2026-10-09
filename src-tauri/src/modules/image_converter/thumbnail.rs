use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use std::{io::Cursor, path::Path};

#[cfg(target_os = "windows")]
#[path = "thumbnail_windows.rs"]
mod windows;

pub const THUMBNAIL_SIZE: u32 = 128;
const MAX_DECODE_BYTES: u64 = 128 * 1024 * 1024;

/// Small, self-contained previews avoid exposing arbitrary files through the asset protocol.
pub fn get_image_thumbnail(path: &Path) -> Option<String> {
    if !path.metadata().ok()?.is_file() {
        return None;
    }

    #[cfg(target_os = "windows")]
    if let Ok(image) = windows::file_image(path, false) {
        return encode_png(DynamicImage::ImageRgba8(image));
    }

    if let Some(image) = decode_thumbnail(path) {
        return encode_png(image);
    }

    #[cfg(target_os = "windows")]
    if let Ok(image) = windows::file_image(path, true) {
        return encode_png(DynamicImage::ImageRgba8(image));
    }

    None
}

fn decode_thumbnail(path: &Path) -> Option<DynamicImage> {
    if path.metadata().ok()?.len() > super::service::MAX_IMAGE_FILE_SIZE {
        return None;
    }
    let mut reader = ImageReader::open(path).ok()?.with_guessed_format().ok()?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(super::service::MAX_IMAGE_DIMENSION);
    limits.max_image_height = Some(super::service::MAX_IMAGE_DIMENSION);
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    reader.limits(limits);
    let decoder = reader.into_decoder().ok()?;
    // Some codecs treat allocation limits as advisory; check the output size as well.
    if decoder.total_bytes() > MAX_DECODE_BYTES {
        return None;
    }
    Some(
        DynamicImage::from_decoder(decoder)
            .ok()?
            .thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE),
    )
}

fn encode_png(image: DynamicImage) -> Option<String> {
    let mut bytes = Cursor::new(Vec::new());
    image.write_to(&mut bytes, ImageFormat::Png).ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(bytes.into_inner())
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, ImageEncoder, Rgba};
    use tempfile::tempdir;

    #[test]
    fn portable_previews_preserve_aspect_ratio_and_support_qoi() {
        let temp = tempdir().unwrap();
        let source = ImageBuffer::from_pixel(512, 256, Rgba([220u8, 40, 60, 255]));
        for extension in ["png", "qoi"] {
            let path = temp.path().join(format!("photo.{extension}"));
            source.save(&path).unwrap();
            let thumbnail = decode_thumbnail(&path).unwrap();
            assert_eq!((thumbnail.width(), thumbnail.height()), (128, 64));
            assert_eq!(thumbnail.to_rgba8().get_pixel(64, 32).0, [220, 40, 60, 255]);
        }
    }

    #[test]
    fn invalid_or_oversized_inputs_do_not_decode() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("broken.png");
        std::fs::write(&path, b"not an image").unwrap();
        assert!(decode_thumbnail(&path).is_none());
        // Highly compressible but larger than the permitted decoded pixel buffer.
        let encoder = image::codecs::png::PngEncoder::new_with_quality(
            std::fs::File::create(&path).unwrap(),
            image::codecs::png::CompressionType::Fast,
            image::codecs::png::FilterType::NoFilter,
        );
        encoder
            .write_image(
                &vec![0; 8192 * 4097 * 4],
                8192,
                4097,
                image::ExtendedColorType::Rgba8,
            )
            .unwrap();
        assert!(decode_thumbnail(&path).is_none());
        assert!(get_image_thumbnail(&temp.path().join("missing.png")).is_none());
        assert!(get_image_thumbnail(temp.path()).is_none());
    }

    #[test]
    fn previews_are_bounded_png_data_urls_for_unicode_paths() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("photo \u{56fe}\u{7247}.png");
        ImageBuffer::from_pixel(512, 256, Rgba([240u8, 20, 30, 255]))
            .save(&path)
            .unwrap();
        let url = get_image_thumbnail(&path).unwrap();
        let png = STANDARD
            .decode(url.strip_prefix("data:image/png;base64,").unwrap())
            .unwrap();
        let preview = image::load_from_memory(&png).unwrap();
        assert!(preview.width() <= THUMBNAIL_SIZE && preview.height() <= THUMBNAIL_SIZE);
        assert_eq!(preview.width(), preview.height() * 2);
        let pixel = preview
            .to_rgba8()
            .get_pixel(preview.width() / 2, preview.height() / 2)
            .0;
        assert!(pixel[0] > 200 && pixel[1] < 50 && pixel[3] == 255);
    }
}

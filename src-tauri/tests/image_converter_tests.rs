use image::{ImageBuffer, Rgb};
use tempfile::tempdir;
use the_berry_lib::modules::image_converter::service::{ConvertTask, ImageConverterService};

#[test]
fn test_image_converter_single_and_batch() {
    let temp = tempdir().expect("failed to create temp dir");
    let input_png = temp.path().join("test_sample.png");
    let out_dir = temp.path().join("output");
    std::fs::create_dir_all(&out_dir).expect("create out dir");

    // Create a 64x64 synthetic RGB test image
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_fn(64, 64, |x, y| Rgb([(x * 4) as u8, (y * 4) as u8, 128]));
    img.save(&input_png).expect("save test png");

    assert!(input_png.exists());

    // Test convert to WebP
    let webp_task = ConvertTask {
        source_path: input_png.to_string_lossy().to_string(),
        target_format: "webp".to_string(),
        quality: 80,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };

    let webp_res = ImageConverterService::convert_single(webp_task);
    assert!(webp_res.success);
    assert!(!webp_res.target_path.is_empty());
    assert!(webp_res.converted_size_bytes > 0);
    assert_eq!(webp_res.width, 64);
    assert_eq!(webp_res.height, 64);

    // Test convert to JPEG
    let jpg_task = ConvertTask {
        source_path: input_png.to_string_lossy().to_string(),
        target_format: "jpeg".to_string(),
        quality: 85,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };

    let jpg_res = ImageConverterService::convert_single(jpg_task);
    assert!(jpg_res.success);
    assert!(!jpg_res.target_path.is_empty());

    // Test non-existent file failure handling
    let fail_task = ConvertTask {
        source_path: temp.path().join("non_existent.png").to_string_lossy().to_string(),
        target_format: "webp".to_string(),
        quality: 80,
        output_dir: None,
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };
    let fail_res = ImageConverterService::convert_single(fail_task);
    assert!(!fail_res.success);
}

#[test]
fn test_image_converter_resizing() {
    let temp = tempdir().expect("failed to create temp dir");
    let input_png = temp.path().join("resize_sample.png");
    let out_dir = temp.path().join("output");
    std::fs::create_dir_all(&out_dir).expect("create out dir");

    // Create 100x100 RGB image
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_fn(100, 100, |x, y| Rgb([(x * 2) as u8, (y * 2) as u8, 200]));
    img.save(&input_png).expect("save test png");

    let resize_task = ConvertTask {
        source_path: input_png.to_string_lossy().to_string(),
        target_format: "png".to_string(),
        quality: 90,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: Some(50),
        resize_height: Some(50),
        preserve_aspect_ratio: Some(true),
    };

    let res = ImageConverterService::convert_single(resize_task);
    assert!(res.success);
    assert_eq!(res.width, 50);
    assert_eq!(res.height, 50);
}

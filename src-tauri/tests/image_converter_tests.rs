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
        quality: Some(80),
        output_dir: Some(out_dir.to_string_lossy().to_string()),
    };

    let webp_res = ImageConverterService::convert_single(&webp_task);
    assert!(webp_res.success);
    assert!(webp_res.output_path.is_some());
    assert!(webp_res.converted_size_bytes.unwrap_or(0) > 0);

    // Test convert to JPEG
    let jpg_task = ConvertTask {
        source_path: input_png.to_string_lossy().to_string(),
        target_format: "jpeg".to_string(),
        quality: Some(85),
        output_dir: Some(out_dir.to_string_lossy().to_string()),
    };

    let jpg_res = ImageConverterService::convert_single(&jpg_task);
    assert!(jpg_res.success);
    assert!(jpg_res.output_path.is_some());

    // Test non-existent file failure handling
    let fail_task = ConvertTask {
        source_path: temp.path().join("non_existent.png").to_string_lossy().to_string(),
        target_format: "webp".to_string(),
        quality: Some(80),
        output_dir: None,
    };
    let fail_res = ImageConverterService::convert_single(&fail_task);
    assert!(!fail_res.success);
}

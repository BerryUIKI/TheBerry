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

#[test]
fn test_heic_corrupted_or_mock_handling() {
    let temp = tempdir().expect("failed to create temp dir");
    let input_heic = temp.path().join("sample.heic");
    let out_dir = temp.path().join("output");
    std::fs::create_dir_all(&out_dir).expect("create out dir");

    // Write invalid/corrupt bytes to simulate corrupt HEIC file
    std::fs::write(&input_heic, b"corrupted heic payload").expect("write corrupt heic");

    let heic_task = ConvertTask {
        source_path: input_heic.to_string_lossy().to_string(),
        target_format: "jpeg".to_string(),
        quality: 85,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };

    let res = ImageConverterService::convert_single(heic_task);
    assert!(!res.success);
    assert!(res.error_message.is_some());
}

#[test]
fn test_scan_image_paths_and_subfolder_creation() {
    let temp = tempdir().expect("failed to create temp dir");
    let sub1 = temp.path().join("subfolder1");
    let sub2 = sub1.join("nested");
    std::fs::create_dir_all(&sub2).expect("create sub folders");

    let img1 = sub1.join("photo1.jpg");
    let img2 = sub2.join("photo2.PNG");
    let textfile = sub1.join("notes.txt");

    let img_data: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_fn(32, 32, |_, _| Rgb([10, 20, 30]));
    img_data.save(&img1).expect("save img1");
    img_data.save(&img2).expect("save img2");
    std::fs::write(&textfile, b"hello").expect("write textfile");

    // Test scan_image_paths recursively
    let scanned = ImageConverterService::scan_image_paths(vec![temp.path().to_string_lossy().to_string()], true);
    assert_eq!(scanned.len(), 2);

    // Test non-recursive scan
    let scanned_sub1 = ImageConverterService::scan_image_paths(vec![sub1.to_string_lossy().to_string()], false);
    assert_eq!(scanned_sub1.len(), 1);

    // Test convert with non-existent new target directory (should auto-create)
    let auto_subfolder = temp.path().join("new_auto_subfolder").join("nested_out");
    assert!(!auto_subfolder.exists());

    let task = ConvertTask {
        source_path: img1.to_string_lossy().to_string(),
        target_format: "jpeg".to_string(),
        quality: 85,
        output_dir: Some(auto_subfolder.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };

    let res = ImageConverterService::convert_single(task);
    assert!(res.success);
    assert!(auto_subfolder.exists());
    assert!(std::path::Path::new(&res.target_path).exists());
}



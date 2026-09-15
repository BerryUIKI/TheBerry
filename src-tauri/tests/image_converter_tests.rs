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

#[test]
fn test_jfif_and_extended_formats() {
    let temp = tempdir().expect("failed to create temp dir");
    let input_jfif = temp.path().join("source.jfif");
    let out_dir = temp.path().join("output");
    std::fs::create_dir_all(&out_dir).expect("create out dir");

    // Create a synthetic image and save it with .jfif extension
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_fn(48, 48, |x, y| Rgb([(x * 5) as u8, (y * 5) as u8, 200]));
    img.save_with_format(&input_jfif, image::ImageFormat::Jpeg).expect("save test jfif");
    assert!(input_jfif.exists());

    // Verify is_supported_image_file recognizes .jfif
    assert!(ImageConverterService::is_supported_image_file(&input_jfif));

    // Test converting .jfif input to PNG
    let jfif_to_png_task = ConvertTask {
        source_path: input_jfif.to_string_lossy().to_string(),
        target_format: "png".to_string(),
        quality: 90,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };
    let png_res = ImageConverterService::convert_single(jfif_to_png_task);
    assert!(png_res.success);
    assert!(png_res.target_path.ends_with("_converted.png"));
    assert_eq!(png_res.width, 48);
    assert_eq!(png_res.height, 48);

    // Test converting to .jfif output format
    let to_jfif_task = ConvertTask {
        source_path: png_res.target_path,
        target_format: "jfif".to_string(),
        quality: 85,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };
    let jfif_res = ImageConverterService::convert_single(to_jfif_task);
    assert!(jfif_res.success);
    assert!(jfif_res.target_path.ends_with("_converted.jfif"));
    assert!(std::path::Path::new(&jfif_res.target_path).exists());

    // Test converting to BMP
    let to_bmp_task = ConvertTask {
        source_path: input_jfif.to_string_lossy().to_string(),
        target_format: "bmp".to_string(),
        quality: 90,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };
    let bmp_res = ImageConverterService::convert_single(to_bmp_task);
    assert!(bmp_res.success);
    assert!(bmp_res.target_path.ends_with("_converted.bmp"));

    // Test converting to ICO (including 256x256 max clamp protection)
    let to_ico_task = ConvertTask {
        source_path: input_jfif.to_string_lossy().to_string(),
        target_format: "ico".to_string(),
        quality: 90,
        output_dir: Some(out_dir.to_string_lossy().to_string()),
        resize_width: None,
        resize_height: None,
        preserve_aspect_ratio: None,
    };
    let ico_res = ImageConverterService::convert_single(to_ico_task);
    assert!(ico_res.success);
    assert!(ico_res.target_path.ends_with("_converted.ico"));
}



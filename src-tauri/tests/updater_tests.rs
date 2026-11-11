use the_berry_lib::modules::updater::service::UpdaterService;

#[test]
fn test_version_comparison_semver() {
    assert!(UpdaterService::is_newer_version("0.1.0", "0.2.0"));
    assert!(UpdaterService::is_newer_version("v0.1.0", "v0.1.1"));
    assert!(UpdaterService::is_newer_version("0.1.0", "1.0.0"));
    assert!(UpdaterService::is_newer_version("0.1.0-dev", "0.1.0"));

    assert!(!UpdaterService::is_newer_version("0.2.0", "0.1.0"));
    assert!(!UpdaterService::is_newer_version("1.0.0", "1.0.0"));
    assert!(!UpdaterService::is_newer_version("v1.5.0", "v1.5.0"));
}

#[test]
fn test_target_asset_keyword_valid() {
    let kw = UpdaterService::get_target_asset_keyword();
    assert!(!kw.is_empty());
    #[cfg(target_os = "windows")]
    assert_eq!(kw, "windows_x64");
}

#[test]
fn test_validate_download_url_security() {
    assert!(UpdaterService::validate_download_url("https://github.com/BerryUIKI/TheBerry/releases/download/v0.1.0/app.exe").is_ok());
    assert!(UpdaterService::validate_download_url("https://objects.githubusercontent.com/github-production-release-asset/app.exe").is_ok());
    assert!(UpdaterService::validate_download_url("https://raw.github.com/BerryUIKI/TheBerry/app.exe").is_ok());
    
    // Malicious or unapproved domains must fail
    assert!(UpdaterService::validate_download_url("http://github.com/app.exe").is_err()); // HTTP not HTTPS
    assert!(UpdaterService::validate_download_url("https://malicious-site.com/app.exe").is_err());
    assert!(UpdaterService::validate_download_url("https://github.com.evil.com/app.exe").is_err());
    assert!(UpdaterService::validate_download_url("not a url").is_err());
}

#[test]
fn test_download_progress_serialization() {
    use the_berry_lib::modules::updater::service::DownloadProgress;

    let progress = DownloadProgress {
        bytes_downloaded: 1048576,
        total_bytes: Some(10485760),
        percent: 10.0,
        speed_bytes_per_sec: 2097152,
        done: false,
        status: "Downloading...".to_string(),
        file_path: Some("C:\\temp\\updates\\the-berry.exe".to_string()),
    };

    let json = serde_json::to_string(&progress).expect("serialization failed");
    assert!(json.contains("speed_bytes_per_sec"));
    assert!(json.contains("2097152"));

    let deserialized: DownloadProgress = serde_json::from_str(&json).expect("deserialization failed");
    assert_eq!(deserialized.speed_bytes_per_sec, 2097152);
    assert_eq!(deserialized.file_path, Some("C:\\temp\\updates\\the-berry.exe".to_string()));
}

#[test]
fn test_get_updates_dir_resolution() {
    use std::path::Path;

    let custom_dir = Path::new("F:\\TheBerryData");
    let updates_dir = UpdaterService::get_updates_dir(Some(custom_dir));
    assert_eq!(updates_dir, custom_dir.join("updates"));

    let default_dir = UpdaterService::get_updates_dir(None);
    assert!(default_dir.to_str().unwrap().contains("updates") || default_dir.to_str().unwrap().contains("Updates"));
}


#[test]
fn test_expected_asset_names_are_installable() {
    let names = UpdaterService::expected_asset_names();
    assert!(!names.is_empty());
    for name in names {
        assert!(
            UpdaterService::is_installable_asset(name),
            "{name} should be installable"
        );
    }
    #[cfg(target_os = "windows")]
    {
        assert_eq!(names.len(), 1);
        assert_eq!(names[0], "the-berry_windows_x64.exe");
    }
}

#[test]
fn test_installable_asset_rejects_checksums() {
    assert!(UpdaterService::is_installable_asset("the-berry_windows_x64.exe"));
    assert!(UpdaterService::is_installable_asset("the-berry_linux_x64.AppImage"));
    assert!(UpdaterService::is_installable_asset("the-berry_macos_aarch64.dmg"));
    assert!(!UpdaterService::is_installable_asset("the-berry_windows_x64.exe.sha256"));
    assert!(!UpdaterService::is_installable_asset("the-berry_linux_x64.deb"));
    assert!(!UpdaterService::is_installable_asset("notes.txt"));
}

#[test]
fn test_parse_sha256_checksum() {
    let digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    let parsed = UpdaterService::parse_sha256_checksum(&format!("{digest}  the-berry.exe\n"))
        .expect("valid checksum should parse");
    assert_eq!(parsed, digest);

    assert!(UpdaterService::parse_sha256_checksum("").is_err());
    assert!(UpdaterService::parse_sha256_checksum("abc").is_err());
    assert!(UpdaterService::parse_sha256_checksum(&"z".repeat(64)).is_err());
}

#[test]
fn test_sha256_file_matches_known_digest() {
    let path = std::env::temp_dir().join(format!("theberry-sha256-{}.txt", std::process::id()));
    std::fs::write(&path, b"abc").expect("failed to write test file");
    let digest = UpdaterService::sha256_file(&path).expect("hashing failed");
    let _ = std::fs::remove_file(&path);

    assert_eq!(
        digest,
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

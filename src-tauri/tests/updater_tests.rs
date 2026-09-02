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

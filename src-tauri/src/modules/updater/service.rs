use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const CURRENT_APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GITHUB_REPO: &str = "BerryUIKI/TheBerry";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: String,
    pub release_url: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub percent: f32,
    #[serde(default)]
    pub speed_bytes_per_sec: u64,
    pub done: bool,
    pub status: String,
    #[serde(default)]
    pub file_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

pub struct UpdaterService;

impl UpdaterService {
    pub fn is_newer_version(current: &str, latest: &str) -> bool {
        let clean_cur = current.trim_start_matches('v').trim();
        let clean_lat = latest.trim_start_matches('v').trim();

        if let (Ok(cur_v), Ok(lat_v)) = (Version::parse(clean_cur), Version::parse(clean_lat)) {
            lat_v > cur_v
        } else {
            false
        }
    }

    pub fn get_target_asset_keyword() -> &'static str {
        #[cfg(target_os = "windows")]
        {
            "windows_x64"
        }
        #[cfg(target_os = "linux")]
        {
            "linux_x64"
        }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            "macos_aarch64"
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            "macos_x64"
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            "unknown"
        }
    }

    /// Exact release asset names the updater is allowed to install on this platform.
    pub fn expected_asset_names() -> &'static [&'static str] {
        #[cfg(target_os = "windows")]
        {
            &["the-berry_windows_x64.exe"]
        }
        #[cfg(target_os = "linux")]
        {
            &["the-berry_linux_x64.AppImage"]
        }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            &["the-berry_macos_aarch64.dmg"]
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            &["the-berry_macos_x64.dmg"]
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            &[]
        }
    }

    /// Installable assets never include the published checksum sidecar files.
    pub fn is_installable_asset(name: &str) -> bool {
        name.ends_with(".exe") || name.ends_with(".AppImage") || name.ends_with(".dmg")
    }

    /// Parses the first 64-hex-character token from a `sha256sum`-format file.
    pub fn parse_sha256_checksum(text: &str) -> Result<String, String> {
        let checksum = text.split_whitespace().next().unwrap_or("");
        if checksum.len() == 64 && checksum.chars().all(|c| c.is_ascii_hexdigit()) {
            Ok(checksum.to_ascii_lowercase())
        } else {
            Err("Checksum file does not contain a valid SHA-256 digest".to_string())
        }
    }

    /// Computes the lowercase SHA-256 hex digest of a file.
    pub fn sha256_file(path: &Path) -> Result<String, String> {
        use sha2::{Digest, Sha256};
        use std::io::Read;

        let mut file = File::open(path)
            .map_err(|e| format!("Failed to open {} for hashing: {e}", path.display()))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let read = file
                .read(&mut buffer)
                .map_err(|e| format!("Failed to hash {}: {e}", path.display()))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub async fn check_latest_release(current_version: &str) -> Result<UpdateInfo, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            GITHUB_REPO
        );

        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("TheBerry-Desktop-App"));

        let response = client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("GitHub Release query failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "GitHub API returned error status: {}",
                response.status()
            ));
        }

        let release = response
            .json::<GitHubRelease>()
            .await
            .map_err(|e| format!("Failed to parse GitHub release JSON: {}", e))?;

        let has_update = Self::is_newer_version(current_version, &release.tag_name);

        let matched_asset = Self::expected_asset_names()
            .iter()
            .find_map(|name| release.assets.iter().find(|asset| asset.name == *name))
            .or_else(|| {
                let keyword = Self::get_target_asset_keyword();
                release
                    .assets
                    .iter()
                    .find(|asset| asset.name.contains(keyword) && Self::is_installable_asset(&asset.name))
            });

        let download_url = matched_asset.map(|a| a.browser_download_url.clone());
        let asset_name = matched_asset.map(|a| a.name.clone());

        Ok(UpdateInfo {
            current_version: current_version.to_string(),
            latest_version: release.tag_name,
            has_update,
            release_notes: release.body.unwrap_or_default(),
            release_url: release.html_url,
            download_url,
            asset_name,
            published_at: release.published_at,
        })
    }

    pub fn validate_download_url(download_url: &str) -> Result<(), String> {
        let url = reqwest::Url::parse(download_url)
            .map_err(|e| format!("Invalid update download URL: {}", e))?;

        let host = url.host_str().unwrap_or("");
        if !["github.com", "objects.githubusercontent.com"].contains(&host)
            && !host.ends_with(".github.com")
        {
            return Err(format!("Untrusted update download URL domain: {}", host));
        }

        if url.scheme() != "https" {
            return Err("Update download URL must use HTTPS".to_string());
        }

        Ok(())
    }

    pub fn get_updates_dir(data_dir: Option<&Path>) -> PathBuf {
        if let Some(root) = data_dir {
            root.join("updates")
        } else {
            dirs::data_dir()
                .map(|d| d.join("TheBerry").join("updates"))
                .unwrap_or_else(|| {
                    dirs::cache_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join("TheBerryUpdates")
                })
        }
    }

    async fn fetch_sha256(client: &reqwest::Client, url: &str) -> Result<String, String> {
        Self::validate_download_url(url)?;
        let response = client
            .get(url)
            .header(USER_AGENT, "TheBerry-Desktop-App")
            .send()
            .await
            .map_err(|e| format!("Checksum download failed: {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "Update checksum is unavailable (HTTP {})",
                response.status()
            ));
        }
        let text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read checksum response: {e}"))?;
        Self::parse_sha256_checksum(&text)
    }

    async fn verify_download(
        client: &reqwest::Client,
        download_url: &str,
        file: &Path,
    ) -> Result<(), String> {
        let expected = Self::fetch_sha256(client, &format!("{download_url}.sha256")).await?;
        let actual = Self::sha256_file(file)?;
        if actual == expected {
            Ok(())
        } else {
            Err(format!(
                "Update checksum mismatch: expected {expected}, downloaded {actual}"
            ))
        }
    }

    pub async fn download_update(
        download_url: &str,
        data_dir: Option<&Path>,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        Self::validate_download_url(download_url)?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let res = client
            .get(download_url)
            .header(USER_AGENT, "TheBerry-Desktop-App")
            .send()
            .await
            .map_err(|e| format!("Failed to connect to download URL: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Download failed with HTTP status: {}", res.status()));
        }

        let total_size = res.content_length();
        let target_filename = download_url
            .split('/')
            .next_back()
            .unwrap_or("the-berry-update.exe");

        let updates_dir = Self::get_updates_dir(data_dir);
        let _ = std::fs::create_dir_all(&updates_dir);
        let destination = updates_dir.join(target_filename);
        let temp_destination = updates_dir.join(format!("{}.part", target_filename));

        let mut file = File::create(&temp_destination)
            .map_err(|e| format!("Failed to create temporary update file on disk: {}", e))?;

        let mut stream = res.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_speed_check = std::time::Instant::now();
        let mut bytes_since_last_check: u64 = 0;
        let mut current_speed: u64 = 0;
        let mut last_emit_time = std::time::Instant::now();

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                bytes_downloaded: 0,
                total_bytes: total_size,
                percent: 0.0,
                speed_bytes_per_sec: 0,
                done: false,
                status: "Starting download...".to_string(),
                file_path: None,
            },
        );

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write chunk: {}", e))?;

            let chunk_len = chunk.len() as u64;
            downloaded += chunk_len;
            bytes_since_last_check += chunk_len;

            let elapsed_speed = last_speed_check.elapsed();
            if elapsed_speed >= Duration::from_millis(400) {
                let secs = elapsed_speed.as_secs_f64();
                if secs > 0.0 {
                    current_speed = (bytes_since_last_check as f64 / secs) as u64;
                }
                bytes_since_last_check = 0;
                last_speed_check = std::time::Instant::now();
            }

            if last_emit_time.elapsed() >= Duration::from_millis(150) {
                let percent = if let Some(tot) = total_size {
                    if tot > 0 {
                        ((downloaded as f32 / tot as f32) * 100.0).min(99.9)
                    } else {
                        0.0
                    }
                } else {
                    0.0
                };

                let _ = app_handle.emit(
                    "update-download-progress",
                    DownloadProgress {
                        bytes_downloaded: downloaded,
                        total_bytes: total_size,
                        percent,
                        speed_bytes_per_sec: current_speed,
                        done: false,
                        status: "Downloading...".to_string(),
                        file_path: None,
                    },
                );
                last_emit_time = std::time::Instant::now();
            }
        }

        file.flush()
            .map_err(|e| format!("Failed to flush file: {}", e))?;
        drop(file);

        if destination.exists() {
            let _ = std::fs::remove_file(&destination);
        }
        std::fs::rename(&temp_destination, &destination)
            .map_err(|e| format!("Failed to finalize update package on disk: {}", e))?;

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                bytes_downloaded: downloaded,
                total_bytes: total_size,
                percent: 99.9,
                speed_bytes_per_sec: 0,
                done: false,
                status: "Verifying checksum...".to_string(),
                file_path: None,
            },
        );

        if let Err(error) = Self::verify_download(&client, download_url, &destination).await {
            let _ = std::fs::remove_file(&destination);
            return Err(error);
        }

        let dest_str = destination.to_string_lossy().to_string();

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                bytes_downloaded: downloaded,
                total_bytes: total_size,
                percent: 100.0,
                speed_bytes_per_sec: 0,
                done: true,
                status: "Download completed".to_string(),
                file_path: Some(dest_str.clone()),
            },
        );

        Ok(dest_str)
    }

    pub fn install_and_restart(
        file_path: Option<&str>,
        silent: bool,
        data_dir: Option<&Path>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let _ = silent;
        let updates_dir = Self::get_updates_dir(data_dir);
        let installer_path: PathBuf = if let Some(custom) = file_path {
            let p = PathBuf::from(custom);
            if p.exists() {
                p
            } else {
                updates_dir.join(custom)
            }
        } else {
            // Find newest .exe or installer in updates_dir
            let mut candidates: Vec<PathBuf> = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&updates_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    #[cfg(target_os = "windows")]
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "exe") {
                        candidates.push(path);
                    }
                    #[cfg(target_os = "macos")]
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "dmg" || ext == "pkg") {
                        candidates.push(path);
                    }
                    #[cfg(target_os = "linux")]
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "AppImage" || ext == "deb") {
                        candidates.push(path);
                    }
                }
            }
            candidates.sort_by_key(|p| {
                p.metadata()
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            });
            candidates
                .into_iter()
                .next_back()
                .ok_or_else(|| "No update installer found in updates directory".to_string())?
        };

        if !installer_path.exists() {
            return Err(format!(
                "Installer file does not exist: {}",
                installer_path.display()
            ));
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let current_exe = std::env::current_exe()
                .map_err(|e| format!("Failed to get current executable path: {}", e))?;

            let bat_path = updates_dir.join("apply_update.bat");
            let silent_flag = if silent { "/S" } else { "" };
            let bat_content = format!(
                "@echo off\r\nchcp 65001 >nul\r\nping 127.0.0.1 -n 2 >nul\r\nstart \"\" /wait \"{}\" {}\r\nstart \"\" \"{}\"\r\ndel \"%~f0\"\r\n",
                installer_path.to_str().unwrap_or_default(),
                silent_flag,
                current_exe.to_str().unwrap_or_default(),
            );

            std::fs::write(&bat_path, bat_content)
                .map_err(|e| format!("Failed to write update launcher batch: {}", e))?;

            let mut cmd = Command::new("cmd");
            cmd.args(["/c", bat_path.to_str().unwrap_or_default()]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.spawn()
                .map_err(|e| format!("Failed to launch in-place installer: {}", e))?;

            // Gracefully terminate current process so NSIS can overwrite files in place
            let app = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(300)).await;
                app.exit(0);
            });
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&installer_path)
                .spawn()
                .map_err(|e| format!("Failed to open disk image: {}", e))?;

            let app = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(300)).await;
                app.exit(0);
            });
        }

        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("chmod")
                .args(["+x", installer_path.to_str().unwrap_or_default()])
                .status();

            Command::new(&installer_path)
                .spawn()
                .map_err(|e| format!("Failed to run update executable: {}", e))?;

            let app = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(300)).await;
                app.exit(0);
            });
        }

        Ok(())
    }

    pub async fn download_and_install_update(
        download_url: &str,
        data_dir: Option<&Path>,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let dest = Self::download_update(download_url, data_dir, app_handle.clone()).await?;
        Self::install_and_restart(Some(&dest), true, data_dir, app_handle)?;
        Ok(dest)
    }

    /// Background daemon that silently checks GitHub for updates once every 24 hours
    pub fn start_daily_check_daemon(app_handle: AppHandle, mut shutdown_rx: tokio::sync::watch::Receiver<bool>) {
        tauri::async_runtime::spawn(async move {
            tokio::select! {
                _ = shutdown_rx.changed() => return,
                _ = tokio::time::sleep(Duration::from_secs(10)) => {}
            }

            loop {
                if *shutdown_rx.borrow() {
                    break;
                }

                if let Ok(info) = Self::check_latest_release(CURRENT_APP_VERSION).await {
                    if info.has_update {
                        let _ = app_handle.emit("app-update-available", info);
                    }
                }

                // Sleep 24 hours before next check, interrupting immediately if shutdown signal received
                tokio::select! {
                    _ = shutdown_rx.changed() => break,
                    _ = tokio::time::sleep(Duration::from_secs(86400)) => {}
                }
            }
        });
    }
}

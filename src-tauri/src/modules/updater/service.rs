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
    pub done: bool,
    pub status: String,
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
            clean_lat != clean_cur
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

        let target_keyword = Self::get_target_asset_keyword();
        let matched_asset = release
            .assets
            .iter()
            .find(|a| a.name.contains(target_keyword))
            .or_else(|| release.assets.first());

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

    pub async fn download_and_install_update(
        download_url: &str,
        data_dir: Option<&Path>,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        Self::validate_download_url(download_url)?;

        let client = reqwest::Client::new();
        let res = client
            .get(download_url)
            .header(USER_AGENT, "TheBerry-Desktop-App")
            .send()
            .await
            .map_err(|e| format!("Failed to connect to download URL: {}", e))?;

        let total_size = res.content_length();
        let target_filename = download_url
            .split('/')
            .last()
            .unwrap_or("the-berry-update.exe");

        let updates_dir = if let Some(root) = data_dir {
            root.join("updates")
        } else {
            dirs::cache_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("TheBerryUpdates")
        };

        let _ = std::fs::create_dir_all(&updates_dir);
        let destination = updates_dir.join(target_filename);

        let mut file = File::create(&destination)
            .map_err(|e| format!("Failed to create update file on disk: {}", e))?;

        let mut stream = res.bytes_stream();
        let mut downloaded: u64 = 0;

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                bytes_downloaded: 0,
                total_bytes: total_size,
                percent: 0.0,
                done: false,
                status: "Downloading update package...".to_string(),
            },
        );

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write chunk: {}", e))?;

            downloaded += chunk.len() as u64;
            let percent = if let Some(tot) = total_size {
                if tot > 0 {
                    (downloaded as f32 / tot as f32) * 100.0
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
                    done: false,
                    status: format!("Downloaded {:.1} MB", downloaded as f32 / (1024.0 * 1024.0)),
                },
            );
        }

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                bytes_downloaded: downloaded,
                total_bytes: total_size,
                percent: 100.0,
                done: true,
                status: "Download completed. Launching installer...".to_string(),
            },
        );

        // Execute Installer
        let dest_str = destination.to_string_lossy().to_string();
        Self::execute_installer(&destination)?;

        Ok(dest_str)
    }

    pub fn execute_installer(installer_path: &Path) -> Result<(), String> {
        if !installer_path.exists() {
            return Err("Installer file does not exist on disk".to_string());
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/c", "start", "", installer_path.to_str().unwrap_or_default()])
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(installer_path)
                .spawn()
                .map_err(|e| format!("Failed to open disk image: {}", e))?;
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("chmod")
                .args(["+x", installer_path.to_str().unwrap_or_default()])
                .status()
                .map_err(|e| format!("Failed to set permissions: {}", e))?;

            Command::new(installer_path)
                .spawn()
                .map_err(|e| format!("Failed to run AppImage: {}", e))?;
        }

        Ok(())
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

//! Pinned, verified, on-demand llama.cpp runtimes. No binaries are installer resources.
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use parking_lot::{Mutex, RwLock};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::process::{Child, Command};
use tokio::sync::watch;

use super::runtime_hardware::{self, Hardware};

const VERSION: &str = "b11425";
const EVENT: &str = "goose://local-runtime-progress";
const CANCELLED: &str = "Runtime preparation cancelled. Select Start to resume.";
const RELEASE: &str = "https://github.com/ggml-org/llama.cpp/releases/download/b11425";

#[cfg(all(windows, target_arch = "x86_64"))]
const PLATFORM_KEY: &str = "windows-x64";
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const PLATFORM_KEY: &str = "macos-arm64";
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const PLATFORM_KEY: &str = "linux-x64";
#[cfg(not(any(
    all(windows, target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
)))]
const PLATFORM_KEY: &str = "unsupported";

pub(super) const SUPPORTED_PLATFORMS: &str = "Windows x64, macOS Apple Silicon, and Linux x64";

pub(super) fn is_supported() -> bool {
    cfg!(any(
        all(windows, target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64")
    ))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendOption {
    pub backend: String,
    pub download_bytes: u64,
    pub is_cached: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalRuntimeStatus {
    pub is_running: bool,
    pub backend: Option<String>,
    pub port: Option<u16>,
    pub model_id: Option<String>,
    pub base_url: Option<String>,
    pub error: Option<String>,
    pub phase: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub available_backends: Vec<BackendOption>,
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
enum Format {
    Zip,
    TarGz,
}

#[derive(Clone, Copy)]
struct Archive {
    name: &'static str,
    bytes: u64,
    sha256: &'static str,
    format: Format,
}

#[cfg(all(windows, target_arch = "x86_64"))]
const CPU: Archive = Archive {
    name: "llama-b11425-bin-win-cpu-x64.zip",
    bytes: 19_395_596,
    sha256: "61ad965cd5e17f5026a05b7258d346cb309e7752490c7e11fbedf332e2040db5",
    format: Format::Zip,
};
#[cfg(all(windows, target_arch = "x86_64"))]
const VULKAN: Archive = Archive {
    name: "llama-b11425-bin-win-vulkan-x64.zip",
    bytes: 33_331_682,
    sha256: "a3287ac487ab5d128aefddc507db31c087f2a41c6e03b01f37fbe0bc45e8717d",
    format: Format::Zip,
};
#[cfg(all(windows, target_arch = "x86_64"))]
const CUDA: Archive = Archive {
    name: "llama-b11425-bin-win-cuda-12.4-x64.zip",
    bytes: 264_468_885,
    sha256: "0d2984647bb9864d8f5a28495605c68f27824e5faf8ad99768fc8b7597745698",
    format: Format::Zip,
};
#[cfg(all(windows, target_arch = "x86_64"))]
const CUDART: Archive = Archive {
    name: "cudart-llama-bin-win-cuda-12.4-x64.zip",
    bytes: 391_443_627,
    sha256: "8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6",
    format: Format::Zip,
};

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const MACOS_ARM64: Archive = Archive {
    name: "llama-b11425-bin-macos-arm64.tar.gz",
    bytes: 11_966_456,
    sha256: "14811f683abf2f32c62df48fcc36dbe4f0da307094080095eebb2b3906e705e4",
    format: Format::TarGz,
};

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const LINUX_CPU: Archive = Archive {
    name: "llama-b11425-bin-ubuntu-x64.tar.gz",
    bytes: 17_682_320,
    sha256: "6a47856d08ecc4030b2fa8b8bf761c96d142d689567f69a0f75e42de430dc34c",
    format: Format::TarGz,
};
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const LINUX_VULKAN: Archive = Archive {
    name: "llama-b11425-bin-ubuntu-vulkan-x64.tar.gz",
    bytes: 31_625_057,
    sha256: "5507e7e8b111874a72c3906bb662227a1735ef60c6a5b20e2ffd5287304fb9ea",
    format: Format::TarGz,
};

#[cfg(all(windows, target_arch = "x86_64"))]
fn archives(backend: &str) -> &'static [Archive] {
    match backend {
        "cuda" => &[CUDA, CUDART],
        "vulkan" => &[VULKAN],
        _ => &[CPU],
    }
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn archives(backend: &str) -> &'static [Archive] {
    match backend {
        "metal" | "cpu" => &[MACOS_ARM64],
        _ => &[],
    }
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn archives(backend: &str) -> &'static [Archive] {
    match backend {
        "vulkan" => &[LINUX_VULKAN],
        "cpu" => &[LINUX_CPU],
        _ => &[],
    }
}

#[cfg(not(any(
    all(windows, target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
)))]
fn archives(_backend: &str) -> &'static [Archive] {
    &[]
}

/// macOS runs Metal and CPU from the same archive, so both backends share one cache.
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn install_key(backend: &str) -> &str {
    if backend == "metal" || backend == "cpu" {
        "metal"
    } else {
        backend
    }
}

#[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
fn install_key(backend: &str) -> &str {
    backend
}

fn mark_cached(options: &mut [BackendOption], backend: &str) {
    let key = install_key(backend);
    for option in options {
        if install_key(&option.backend) == key {
            option.is_cached = true;
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Installed {
    version: String,
    backend: String,
    files: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct Preference {
    fingerprint: String,
    backend: String,
}

type StartResult = Result<LocalRuntimeStatus, String>;
type ProgressEmitter = Arc<dyn Fn(LocalRuntimeStatus) + Send + Sync>;

struct Flight {
    model_id: String,
    backend: Option<String>,
    cancel: Arc<AtomicBool>,
    result: watch::Receiver<Option<StartResult>>,
}

struct Server {
    child: Child,
    model_id: String,
    backend: String,
}

pub struct RuntimeManager {
    data_dir: RwLock<PathBuf>,
    state: Mutex<LocalRuntimeStatus>,
    flight: Mutex<Option<Flight>>,
    server: Mutex<Option<Server>>,
    emitter: Mutex<Option<ProgressEmitter>>,
    client: reqwest::Client,
}

impl RuntimeManager {
    pub fn new(data_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            data_dir: RwLock::new(data_dir),
            state: Mutex::new(LocalRuntimeStatus {
                phase: "idle".into(),
                ..Default::default()
            }),
            flight: Mutex::new(None),
            server: Mutex::new(None),
            emitter: Mutex::new(None),
            client: reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        })
    }

    pub fn set_data_dir(&self, directory: PathBuf) {
        *self.data_dir.write() = directory;
    }

    fn root(&self) -> PathBuf {
        self.data_dir
            .read()
            .join("local-runtimes/llama")
            .join(VERSION)
            .join(PLATFORM_KEY)
    }

    fn update(&self, change: impl FnOnce(&mut LocalRuntimeStatus)) {
        let snapshot = {
            let mut state = self.state.lock();
            change(&mut state);
            state.clone()
        };
        let emitter = self.emitter.lock().clone();
        if let Some(emit) = emitter {
            emit(snapshot);
        }
    }

    pub fn status(&self) -> LocalRuntimeStatus {
        let exited = {
            let mut server = self.server.lock();
            if server
                .as_mut()
                .is_some_and(|s| s.child.try_wait().ok().flatten().is_some())
            {
                server.take();
                true
            } else {
                false
            }
        };
        if exited {
            self.update(|s| {
                s.is_running = false;
                s.port = None;
                s.base_url = None;
                s.phase = "failed".into();
                s.error = Some(
                    "The local inference process exited. Retry or choose another backend.".into(),
                );
            });
        }
        self.state.lock().clone()
    }

    pub fn cancel(&self) -> bool {
        if let Some(flight) = self.flight.lock().as_ref() {
            flight.cancel.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn shutdown(&self) {
        self.cancel();
        if let Some(server) = self.server.lock().as_mut() {
            let _ = server.child.start_kill();
        }
    }

    pub async fn stop(&self) -> Result<(), String> {
        let receiver = self.flight.lock().as_ref().map(|f| {
            f.cancel.store(true, Ordering::SeqCst);
            f.result.clone()
        });
        if let Some(receiver) = receiver {
            let _ = wait_result(receiver).await;
        }
        let server = self.server.lock().take();
        if let Some(mut server) = server {
            server
                .child
                .kill()
                .await
                .map_err(|e| format!("Could not stop llama.cpp: {e}"))?;
        }
        self.update(|s| {
            s.is_running = false;
            s.port = None;
            s.base_url = None;
            s.error = None;
            s.phase = "idle".into();
        });
        Ok(())
    }

    pub async fn start(
        self: &Arc<Self>,
        app: AppHandle,
        model_id: String,
        model_path: PathBuf,
        model_hash: String,
        backend: Option<String>,
    ) -> StartResult {
        if !is_supported() {
            return Err(format!(
                "The managed local provider is supported on {SUPPORTED_PLATFORMS}."
            ));
        }
        let requested_model = model_id.clone();
        let requested_backend = backend.clone();
        self.coordinate(model_id, backend, move |manager, cancel| async move {
            *manager.emitter.lock() = Some(Arc::new(move |snapshot| {
                let _ = app.emit(EVENT, snapshot);
            }));
            manager
                .prepare_and_start(
                    requested_model,
                    model_path,
                    model_hash,
                    requested_backend,
                    cancel,
                )
                .await
        })
        .await
    }

    async fn coordinate<F, Fut>(
        self: &Arc<Self>,
        model_id: String,
        backend: Option<String>,
        prepare: F,
    ) -> StartResult
    where
        F: FnOnce(Arc<Self>, Arc<AtomicBool>) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = StartResult> + Send + 'static,
    {
        let mut prepare = Some(prepare);
        loop {
            let (receiver, same_request) = {
                let mut flight = self.flight.lock();
                // Completed results remain available to all existing waiters. A new
                // operation can replace them without racing the completion handler.
                if flight.as_ref().is_some_and(|f| f.result.borrow().is_some()) {
                    flight.take();
                }
                if let Some(flight) = flight.as_ref() {
                    (
                        flight.result.clone(),
                        flight.model_id == model_id && flight.backend == backend,
                    )
                } else {
                    let running = self.server.lock().as_mut().is_some_and(|s| {
                        s.model_id == model_id
                            && backend.as_ref().is_none_or(|b| b == &s.backend)
                            && s.child.try_wait().ok().flatten().is_none()
                    });
                    if running {
                        return Ok(self.status());
                    }
                    let (sender, receiver) = watch::channel(None);
                    let cancel = Arc::new(AtomicBool::new(false));
                    *flight = Some(Flight {
                        model_id: model_id.clone(),
                        backend: backend.clone(),
                        cancel: cancel.clone(),
                        result: receiver.clone(),
                    });
                    let manager = self.clone();
                    let prepare = prepare.take().expect("preparation is spawned only once");
                    tokio::spawn(async move {
                        let result = prepare(manager.clone(), cancel.clone()).await;
                        if let Err(error) = &result {
                            manager.update(|s| {
                                s.phase = if cancel.load(Ordering::SeqCst) {
                                    "cancelled"
                                } else {
                                    "failed"
                                }
                                .into();
                                s.error = Some(error.clone());
                            });
                        }
                        manager.emitter.lock().take();
                        sender.send_replace(Some(result));
                    });
                    (receiver, true)
                }
            };
            let result = wait_result(receiver).await;
            if same_request {
                return result;
            }
        }
    }

    async fn prepare_and_start(
        &self,
        model_id: String,
        model_path: PathBuf,
        model_hash: String,
        requested: Option<String>,
        cancel: Arc<AtomicBool>,
    ) -> StartResult {
        let root = self.root();
        let old = self.server.lock().take();
        if let Some(mut old) = old {
            let _ = old.child.kill().await;
        }
        self.update(|s| {
            s.is_running = false;
            s.port = None;
            s.base_url = None;
            s.model_id = Some(model_id.clone());
            s.phase = "detecting".into();
            s.error = None;
            s.downloaded_bytes = 0;
            s.total_bytes = 0;
        });
        let hardware = tokio::select! {
            _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.into()),
            result = tokio::time::timeout(Duration::from_secs(15), tokio::task::spawn_blocking(runtime_hardware::detect)) => result.map_err(|_| "Hardware detection timed out. Retry after checking the GPU drivers.".to_string())?.map_err(|e| e.to_string())?,
        };
        check_cancel(&cancel)?;
        let options: Vec<BackendOption> = hardware
            .backends()
            .iter()
            .map(|b| BackendOption {
                backend: (*b).into(),
                download_bytes: archives(b).iter().map(|a| a.bytes).sum(),
                is_cached: installed(&root.join(install_key(b)), install_key(b)),
            })
            .collect();
        self.update(|s| s.available_backends = options);
        let backend = select_backend(&hardware, requested.as_deref(), &root)?;
        self.update(|s| {
            s.backend = Some(backend.clone());
            s.total_bytes = archives(&backend).iter().map(|a| a.bytes).sum();
        });
        self.update(|s| s.phase = "verifying".into());
        let checked_model = model_path.clone();
        let hash_cancel = cancel.clone();
        let actual = tokio::task::spawn_blocking(move || hash_file(&checked_model, &hash_cancel))
            .await
            .map_err(|e| e.to_string())??;
        if actual != model_hash {
            return Err("The selected model failed SHA-256 verification. Remove it and import or download it again.".into());
        }
        let directory = self
            .ensure_installed(&root, &backend, cancel.clone())
            .await?;
        check_cancel(&cancel)?;
        self.update(|s| {
            s.phase = "starting".into();
            mark_cached(&mut s.available_backends, &backend);
        });
        let port = super::process::GooseProcessManager::find_available_port(8000, 8999)
            .ok_or("No available local inference port could be found.")?;
        let log_path = root.join("startup.log");
        let log =
            File::create(&log_path).map_err(|e| format!("Could not create runtime log: {e}"))?;
        let mut command = server_command(&directory);
        command
            .arg("--model")
            .arg(&model_path)
            .args([
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--ctx-size",
                "4096",
                "--jinja",
                "--alias",
                &model_id,
                "--n-gpu-layers",
                if backend == "cpu" { "0" } else { "999" },
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::from(log));
        let mut child = command.spawn().map_err(|e| {
            format!("Could not start {backend} runtime: {e}. Retry or choose another backend.")
        })?;
        let health_url = format!("http://127.0.0.1:{port}/health");
        let started = tokio::time::Instant::now();
        while started.elapsed() < Duration::from_secs(75) {
            check_cancel(&cancel)?;
            if child.try_wait().map_err(|e| e.to_string())?.is_some() {
                return Err(startup_error(&backend, &log_path));
            }
            let response = tokio::select! {
                _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.into()),
                response = self.client.get(&health_url).timeout(Duration::from_secs(2)).send() => response,
            };
            if response.is_ok_and(|r| r.status().is_success()) {
                check_cancel(&cancel)?;
                *self.server.lock() = Some(Server {
                    child,
                    model_id,
                    backend: backend.clone(),
                });
                if requested.is_some() {
                    let preference = Preference {
                        fingerprint: hardware.fingerprint,
                        backend: backend.clone(),
                    };
                    // A preference write failure must not invalidate a running server.
                    if let Ok(body) = serde_json::to_vec(&preference) {
                        if let Err(e) = fs::write(root.join("preference.json"), body) {
                            tracing::warn!("Could not save runtime preference: {e}");
                        }
                    }
                }
                self.update(|s| {
                    s.phase = "running".into();
                    s.is_running = true;
                    s.port = Some(port);
                    s.base_url = Some(format!("http://127.0.0.1:{port}/v1"));
                    s.error = None;
                    mark_cached(&mut s.available_backends, &backend);
                });
                return Ok(self.status());
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        let _ = child.kill().await;
        Err(startup_error(&backend, &log_path))
    }

    async fn ensure_installed(
        &self,
        root: &Path,
        backend: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<PathBuf, String> {
        let key = install_key(backend);
        let destination = root.join(key);
        if installed(&destination, key) {
            return Ok(destination);
        }
        let downloads = root.join("downloads");
        fs::create_dir_all(&downloads)
            .map_err(|e| format!("Could not create runtime cache: {e}"))?;
        let stage = root.join(format!(".{key}-staging"));
        if stage.exists() {
            fs::remove_dir_all(&stage).map_err(|e| e.to_string())?;
        }
        fs::create_dir_all(&stage).map_err(|e| e.to_string())?;
        let result = self
            .install_archives(&downloads, &stage, backend, cancel.clone())
            .await;
        if let Err(error) = result {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
        let result = async {
            self.update(|s| s.phase = "verifying".into());
            let mut command = server_command(&stage);
            command.arg("--version");
            let output = tokio::select! {
                _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.to_string()),
                output = tokio::time::timeout(Duration::from_secs(15), command.output()) => output.map_err(|_| "Runtime version verification timed out.".to_string())?.map_err(|e| format!("Runtime dependency verification failed: {e}"))?,
            };
            let version = format!("{} {}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
            if !output.status.success() || !version.split(|c: char| !c.is_ascii_alphanumeric()).any(|word| word == VERSION || word == "11425") {
                return Err(format!("Runtime did not report pinned version {VERSION}: {version}"));
            }
            fs::write(stage.join("LICENSE.llama.cpp"), include_str!("runtime_license.txt")).map_err(|e| e.to_string())?;
            let files = fs::read_dir(&stage).map_err(|e| e.to_string())?.map(|entry| entry.map(|e| e.file_name().to_string_lossy().into_owned())).collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            let marker = Installed { version: VERSION.into(), backend: key.into(), files };
            fs::write(stage.join("installed.json"), serde_json::to_vec(&marker).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            check_cancel(&cancel)?;
            self.update(|s| s.phase = "installing".into());
            commit_installation(&stage, &destination, cancel.clone()).await?;
            Ok(())
        }.await;
        if let Err(error) = result {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
        for archive in archives(backend) {
            let _ = fs::remove_file(downloads.join(archive.name));
        }
        Ok(destination)
    }

    async fn install_archives(
        &self,
        downloads: &Path,
        stage: &Path,
        backend: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let mut completed = 0;
        for archive in archives(backend) {
            let path = downloads.join(archive.name);
            self.update(|s| {
                s.phase = "downloading".into();
                s.downloaded_bytes = completed;
            });
            download_archive(
                &self.client,
                &format!("{RELEASE}/{}", archive.name),
                &path,
                archive,
                cancel.clone(),
                |bytes| self.update(|s| s.downloaded_bytes = completed + bytes),
            )
            .await?;
            self.update(|s| s.phase = "verifying".into());
            verify_archive(path.clone(), archive.sha256.to_owned(), cancel.clone()).await?;
            self.update(|s| s.phase = "installing".into());
            let stage = stage.to_owned();
            let extract_cancel = cancel.clone();
            #[cfg(all(windows, target_arch = "x86_64"))]
            let dependency = archive.name == CUDART.name;
            #[cfg(not(all(windows, target_arch = "x86_64")))]
            let dependency = false;
            let format = archive.format;
            tokio::task::spawn_blocking(move || {
                extract_runtime(&path, format, &stage, dependency, &extract_cancel)
            })
            .await
            .map_err(|e| e.to_string())??;
            completed += archive.bytes;
        }
        check_required_files(stage, install_key(backend))
    }
}

impl Drop for RuntimeManager {
    fn drop(&mut self) {
        if let Some(flight) = self.flight.get_mut().as_ref() {
            flight.cancel.store(true, Ordering::SeqCst);
        }
        if let Some(server) = self.server.get_mut().as_mut() {
            let _ = server.child.start_kill();
        }
    }
}

async fn wait_result(mut receiver: watch::Receiver<Option<StartResult>>) -> StartResult {
    loop {
        if let Some(result) = receiver.borrow().clone() {
            return result;
        }
        receiver
            .changed()
            .await
            .map_err(|_| "Runtime preparation stopped unexpectedly.".to_string())?;
    }
}

async fn commit_installation(
    stage: &Path,
    destination: &Path,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    // Windows may briefly retain image/antivirus handles after --version exits.
    // Keep the fully verified directory staged until its atomic rename succeeds.
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    loop {
        check_cancel(&cancel)?;
        let result = (|| {
            if destination.exists() {
                fs::remove_dir_all(destination)?;
            }
            fs::rename(stage, destination)
        })();
        match result {
            Ok(()) => return Ok(()),
            Err(error) if (error.kind() == std::io::ErrorKind::PermissionDenied || matches!(error.raw_os_error(), Some(32 | 33))) && tokio::time::Instant::now() < deadline => {
                tokio::select! {
                    _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.into()),
                    _ = tokio::time::sleep(Duration::from_millis(200)) => {}
                }
            }
            Err(error) => return Err(format!("Could not commit runtime installation: {error}. Check directory permissions and retry.")),
        }
    }
}

pub(super) async fn wait_cancel(cancel: Arc<AtomicBool>) {
    while !cancel.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

fn check_cancel(cancel: &AtomicBool) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        Err(CANCELLED.into())
    } else {
        Ok(())
    }
}

fn select_backend(
    hardware: &Hardware,
    requested: Option<&str>,
    root: &Path,
) -> Result<String, String> {
    let available = hardware.backends();
    if let Some(backend) = requested {
        return if available.contains(&backend) {
            Ok(backend.into())
        } else {
            Err(format!(
                "The {backend} backend is not supported by the detected hardware and drivers."
            ))
        };
    }
    let preference = fs::read(root.join("preference.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<Preference>(&b).ok());
    if let Some(p) = preference.filter(|p| {
        p.fingerprint == hardware.fingerprint && available.contains(&p.backend.as_str())
    }) {
        return Ok(p.backend);
    }
    Ok(available[0].into())
}

fn installed(directory: &Path, backend: &str) -> bool {
    let marker = fs::read(directory.join("installed.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<Installed>(&b).ok());
    marker.is_some_and(|m| {
        m.version == VERSION
            && m.backend == backend
            && !m.files.is_empty()
            && m.files
                .iter()
                .all(|f| Path::new(f).components().count() == 1 && directory.join(f).is_file())
            && check_required_files(directory, backend).is_ok()
    })
}

fn check_required_files(directory: &Path, backend: &str) -> Result<(), String> {
    for file in required_files(backend) {
        if !directory.join(file).is_file() {
            return Err(format!(
                "Runtime is missing required file {file}. Retry the runtime installation."
            ));
        }
    }
    if !has_cpu_library(directory) {
        return Err("Runtime is missing its CPU library. Retry the runtime installation.".into());
    }
    Ok(())
}

#[cfg(all(windows, target_arch = "x86_64"))]
fn required_files(backend: &str) -> Vec<&'static str> {
    let mut required = vec![
        "llama-server.exe",
        "llama-server-impl.dll",
        "llama-common.dll",
        "llama.dll",
        "ggml.dll",
        "ggml-base.dll",
    ];
    if backend == "cuda" {
        required.extend([
            "ggml-cuda.dll",
            "cudart64_12.dll",
            "cublas64_12.dll",
            "cublasLt64_12.dll",
        ]);
    }
    if backend == "vulkan" {
        required.push("ggml-vulkan.dll");
    }
    required
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn required_files(backend: &str) -> Vec<&'static str> {
    let mut required = vec![
        "llama-server",
        "libllama-server-impl.dylib",
        "libllama.dylib",
        "libllama-common.dylib",
        "libggml.dylib",
        "libggml-base.dylib",
        "libggml-cpu.dylib",
    ];
    if backend == "metal" {
        required.push("libggml-metal.dylib");
    }
    required
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn required_files(backend: &str) -> Vec<&'static str> {
    let mut required = vec![
        "llama-server",
        "libllama-server-impl.so",
        "libllama.so",
        "libllama-common.so",
        "libggml.so",
        "libggml-base.so",
    ];
    if backend == "vulkan" {
        required.push("libggml-vulkan.so");
    }
    required
}

#[cfg(not(any(
    all(windows, target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
)))]
fn required_files(_backend: &str) -> Vec<&'static str> {
    Vec::new()
}

// CPU distributions ship architecture-specific library variants instead of one
// canonical file, so the check accepts any matching variant.
#[cfg(all(windows, target_arch = "x86_64"))]
fn has_cpu_library(directory: &Path) -> bool {
    fs::read_dir(directory).ok().is_some_and(|entries| {
        entries.filter_map(Result::ok).any(|e| {
            let name = e.file_name().to_string_lossy().to_ascii_lowercase();
            name.starts_with("ggml-cpu") && name.ends_with(".dll")
        })
    })
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn has_cpu_library(directory: &Path) -> bool {
    directory.join("libggml-cpu.dylib").is_file()
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn has_cpu_library(directory: &Path) -> bool {
    fs::read_dir(directory).ok().is_some_and(|entries| {
        entries.filter_map(Result::ok).any(|e| {
            let name = e.file_name().to_string_lossy().to_ascii_lowercase();
            name.starts_with("libggml-cpu-") && name.ends_with(".so")
        })
    })
}

#[cfg(not(any(
    all(windows, target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
)))]
fn has_cpu_library(_directory: &Path) -> bool {
    false
}

fn server_binary() -> &'static str {
    #[cfg(windows)]
    {
        "llama-server.exe"
    }
    #[cfg(not(windows))]
    {
        "llama-server"
    }
}

fn server_command(directory: &Path) -> Command {
    let mut command = Command::new(directory.join(server_binary()));
    command.current_dir(directory).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    command
}

fn startup_error(backend: &str, log: &Path) -> String {
    let tail = (|| -> std::io::Result<String> {
        let mut file = File::open(log)?;
        let length = file.metadata()?.len();
        file.seek(SeekFrom::Start(length.saturating_sub(4096)))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    })()
    .unwrap_or_default();
    format!("The {backend} runtime failed to start. Retry or choose another backend. {tail}")
}

fn hash_file(path: &Path, cancel: &AtomicBool) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        check_cancel(cancel)?;
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

async fn verify_archive(
    path: PathBuf,
    expected: String,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    let checked = path.clone();
    let valid = tokio::task::spawn_blocking(move || {
        hash_file(&checked, &cancel).map(|hash| hash == expected)
    })
    .await
    .map_err(|e| e.to_string())??;
    if !valid {
        let _ = fs::remove_file(&path);
        return Err(
            "SHA-256 verification failed. The corrupt archive was removed; retry the download."
                .into(),
        );
    }
    Ok(())
}

async fn download_archive(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    archive: &Archive,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u64),
) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    let mut offset = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if offset > archive.bytes {
        fs::remove_file(path).map_err(|e| e.to_string())?;
        offset = 0;
    }
    progress(offset);
    if offset == archive.bytes {
        return Ok(());
    }
    check_cancel(&cancel)?;
    let mut request = client.get(url);
    if offset > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={offset}-"));
    }
    let response = tokio::select! {
        _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.into()),
        result = tokio::time::timeout(Duration::from_secs(30), request.send()) => result.map_err(|_| "Runtime download connection timed out.".to_string())?.map_err(|e| format!("Runtime download failed: {e}"))?,
    };
    let response = if offset > 0 && response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE
    {
        offset = 0;
        tokio::select! {
            _ = wait_cancel(cancel.clone()) => return Err(CANCELLED.into()),
            result = tokio::time::timeout(Duration::from_secs(30), client.get(url).send()) => result.map_err(|_| "Runtime download connection timed out.".to_string())?.map_err(|e| format!("Runtime download failed: {e}"))?,
        }
    } else {
        response
    };
    let response = response
        .error_for_status()
        .map_err(|e| format!("Runtime download failed: {e}"))?;
    let resumed = offset > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if response.status() == reqwest::StatusCode::PARTIAL_CONTENT {
        let expected = format!("bytes {offset}-");
        if !response
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| {
                v.starts_with(&expected) && v.ends_with(&format!("/{}", archive.bytes))
            })
        {
            let _ = fs::remove_file(path);
            return Err(
                "The runtime server returned an invalid download range. Retry the download.".into(),
            );
        }
    }
    if !resumed {
        offset = 0;
    }
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(resumed)
        .truncate(!resumed)
        .open(path)
        .await
        .map_err(|e| {
            format!("Could not open runtime download (check disk space and permissions): {e}")
        })?;
    let mut stream = response.bytes_stream();
    let mut downloaded = offset;
    let mut last_update = tokio::time::Instant::now();
    loop {
        let next = tokio::select! {
            _ = wait_cancel(cancel.clone()) => { file.flush().await.map_err(|e| e.to_string())?; return Err(CANCELLED.into()); },
            next = tokio::time::timeout(Duration::from_secs(30), stream.next()) => next.map_err(|_| "Runtime download stalled. Retry to resume.".to_string())?,
        };
        let Some(chunk) = next else {
            break;
        };
        let chunk =
            chunk.map_err(|e| format!("Runtime download interrupted; retry to resume: {e}"))?;
        downloaded += chunk.len() as u64;
        if downloaded > archive.bytes {
            drop(file);
            let _ = fs::remove_file(path);
            return Err("Runtime archive exceeded its pinned size.".into());
        }
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Could not write runtime download (check disk space): {e}"))?;
        if last_update.elapsed() >= Duration::from_millis(100) {
            progress(downloaded);
            last_update = tokio::time::Instant::now();
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    progress(downloaded);
    if downloaded != archive.bytes {
        return Err("Runtime download is incomplete. Retry to resume.".into());
    }
    Ok(())
}

fn extract_runtime(
    archive: &Path,
    format: Format,
    stage: &Path,
    dependency: bool,
    cancel: &AtomicBool,
) -> Result<(), String> {
    match format {
        Format::Zip => extract_zip(archive, stage, dependency, cancel),
        Format::TarGz => extract_tar_gz(archive, stage, dependency, cancel),
    }
}

fn is_notice_name(lower: &str) -> bool {
    lower.starts_with("license")
        || lower.starts_with("notice")
        || lower.starts_with("copying")
        || lower.starts_with("copyright")
}

fn is_runtime_file(lower: &str) -> bool {
    lower == "llama-server"
        || lower == "llama-server.exe"
        || lower.ends_with(".dll")
        || lower.ends_with(".dylib")
        || lower.ends_with(".so")
        || lower.contains(".so.")
        || is_notice_name(lower)
}

fn notice_target(name: &str, index: usize, dependency: bool) -> String {
    format!(
        "{}-{index}-{name}",
        if dependency {
            "cuda-notice"
        } else {
            "llama-notice"
        }
    )
}

fn extract_zip(
    archive: &Path,
    stage: &Path,
    dependency: bool,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let file = File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid runtime ZIP: {e}"))?;
    for index in 0..zip.len() {
        check_cancel(cancel)?;
        let mut entry = zip.by_index(index).map_err(|e| e.to_string())?;
        let enclosed = entry
            .enclosed_name()
            .ok_or("Runtime ZIP contains an unsafe path.")?;
        if entry.name().contains('\\')
            || entry.name().contains(':')
            || entry.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000)
        {
            return Err("Runtime ZIP contains an unsafe path or symlink.".into());
        }
        if entry.is_dir() {
            continue;
        }
        let name = enclosed
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid runtime file name.")?;
        let lower = name.to_ascii_lowercase();
        if !is_runtime_file(&lower) {
            continue;
        }
        let target_name = if is_notice_name(&lower) {
            notice_target(name, index, dependency)
        } else {
            name.to_owned()
        };
        let target = stage.join(target_name);
        if target.exists() {
            return Err(format!("Duplicate runtime ZIP file: {name}"));
        }
        let mut output = File::create(target)
            .map_err(|e| format!("Could not install runtime file (check disk space): {e}"))?;
        let mut buffer = vec![0u8; 1024 * 1024];
        loop {
            check_cancel(cancel)?;
            let read = entry.read(&mut buffer).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            output
                .write_all(&buffer[..read])
                .map_err(|e| format!("Could not install runtime file (check disk space): {e}"))?;
        }
    }
    Ok(())
}

fn extract_tar_gz(
    archive: &Path,
    stage: &Path,
    dependency: bool,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let file = File::open(archive).map_err(|e| e.to_string())?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(decoder);
    let mut seen = std::collections::HashSet::new();
    let entries = tar
        .entries()
        .map_err(|e| format!("Invalid runtime archive: {e}"))?;
    for (index, entry) in entries.enumerate() {
        check_cancel(cancel)?;
        let mut entry = entry.map_err(|e| format!("Invalid runtime archive: {e}"))?;
        let path = entry
            .path()
            .map_err(|e| format!("Invalid runtime path: {e}"))?
            .into_owned();
        validate_flat_name(&path)?;
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid runtime file name.")?
            .to_owned();
        let lower = name.to_ascii_lowercase();
        let kind = entry.header().entry_type();
        if kind.is_dir() {
            continue;
        }
        if !is_runtime_file(&lower) {
            continue;
        }
        if kind.is_symlink() {
            let target = entry
                .link_name()
                .map_err(|e| e.to_string())?
                .ok_or("Invalid runtime symlink.")?
                .into_owned();
            validate_symlink_target(&target)?;
            if !seen.insert(name.clone()) {
                return Err(format!("Duplicate runtime archived file: {name}"));
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::symlink;
                let link = stage.join(&name);
                if link.exists() {
                    return Err(format!("Duplicate runtime archived file: {name}"));
                }
                symlink(&target, &link)
                    .map_err(|e| format!("Could not install runtime symlink: {e}"))?;
                continue;
            }
            #[cfg(not(unix))]
            {
                return Err("Runtime symlinks are not supported on this platform.".into());
            }
        }
        if !kind.is_file() {
            return Err("Runtime archive contains an unsupported entry type.".into());
        }
        let target_name = if is_notice_name(&lower) {
            notice_target(&name, index, dependency)
        } else {
            name.clone()
        };
        if !seen.insert(target_name.clone()) {
            return Err(format!("Duplicate runtime archived file: {name}"));
        }
        let target = stage.join(&target_name);
        let mut output = File::create(&target)
            .map_err(|e| format!("Could not install runtime file (check disk space): {e}"))?;
        let mut buffer = vec![0u8; 1024 * 1024];
        loop {
            check_cancel(cancel)?;
            let read = entry.read(&mut buffer).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            output
                .write_all(&buffer[..read])
                .map_err(|e| format!("Could not install runtime file (check disk space): {e}"))?;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = entry.header().mode().unwrap_or(0o644) & 0o777;
            let mode = if mode == 0 { 0o644 } else { mode };
            fs::set_permissions(&target, fs::Permissions::from_mode(mode))
                .map_err(|e| format!("Could not set runtime file permissions: {e}"))?;
        }
    }
    Ok(())
}

fn validate_flat_name(path: &Path) -> Result<(), String> {
    let text = path.to_string_lossy();
    if path.is_absolute()
        || text.contains('\\')
        || text.contains(':')
        || path
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err("Runtime archive contains an unsafe path.".into());
    }
    Ok(())
}

fn validate_symlink_target(target: &Path) -> Result<(), String> {
    let text = target.to_string_lossy();
    let mut components = target.components();
    if !matches!(components.next(), Some(std::path::Component::Normal(_)))
        || components.next().is_some()
        || text.contains('\\')
        || text.contains(':')
    {
        return Err("Runtime archive contains an unsafe symlink.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use tempfile::tempdir;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::sync::Notify;

    fn hardware(cuda: bool, vulkan: bool) -> Hardware {
        Hardware {
            cuda,
            vulkan,
            metal: false,
            fingerprint: "test-device-driver".into(),
        }
    }

    #[test]
    fn orders_metal_after_discrete_backends_and_before_cpu() {
        let hw = Hardware {
            metal: true,
            ..hardware(false, false)
        };
        assert_eq!(hw.backends(), vec!["metal", "cpu"]);
    }

    #[test]
    fn selects_only_compatible_backends_in_performance_order() {
        let root = tempdir().unwrap();
        for (cuda, vulkan, expected) in [
            (true, true, "cuda"),
            (true, false, "cuda"),
            (false, true, "vulkan"),
            (false, false, "cpu"),
        ] {
            assert_eq!(
                select_backend(&hardware(cuda, vulkan), None, root.path()).unwrap(),
                expected
            );
        }
        assert!(select_backend(&hardware(false, true), Some("cuda"), root.path()).is_err());
        assert!(select_backend(&hardware(true, true), Some("../cuda"), root.path()).is_err());
        assert_eq!(
            select_backend(&hardware(true, true), Some("cpu"), root.path()).unwrap(),
            "cpu"
        );
    }

    #[test]
    fn remembers_explicit_choice_only_for_matching_hardware_and_driver() {
        let root = tempdir().unwrap();
        let mut hw = hardware(true, true);
        let preference = Preference {
            fingerprint: hw.fingerprint.clone(),
            backend: "cpu".into(),
        };
        fs::write(
            root.path().join("preference.json"),
            serde_json::to_vec(&preference).unwrap(),
        )
        .unwrap();
        assert_eq!(select_backend(&hw, None, root.path()).unwrap(), "cpu");
        hw.fingerprint = "new-driver".into();
        assert_eq!(select_backend(&hw, None, root.path()).unwrap(), "cuda");
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
        for (name, data) in entries {
            zip.start_file(
                *name,
                zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
            zip.write_all(data).unwrap();
        }
        zip.finish().unwrap();
    }

    #[test]
    fn trims_tools_but_preserves_server_dynamic_libraries_and_notices() {
        let root = tempdir().unwrap();
        let zip = root.path().join("runtime.zip");
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        write_zip(
            &zip,
            &[
                ("bin/llama-server.exe", b"server"),
                ("bin/llama-server-impl.dll", b"dll"),
                ("bin/ggml-cpu-zen4.dll", b"cpu"),
                ("LICENSE-LLVM-OpenMP", b"license"),
                ("llama-bench.exe", b"tool"),
                ("server.pdb", b"symbols"),
                ("example.cpp", b"source"),
            ],
        );
        extract_runtime(&zip, Format::Zip, &stage, false, &AtomicBool::new(false)).unwrap();
        let names: Vec<_> = fs::read_dir(&stage)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names.len(), 4);
        assert!(stage.join("llama-server.exe").is_file());
        assert!(stage.join("llama-server-impl.dll").is_file());
        assert!(stage.join("ggml-cpu-zen4.dll").is_file());
        assert!(names.iter().any(|n| n.contains("LICENSE-LLVM-OpenMP")));
    }

    #[test]
    fn rejects_zip_traversal_and_duplicate_flattened_names() {
        for names in [
            ["../escape.dll", "normal.dll"],
            ["a/library.dll", "b/library.dll"],
            ["C:/escape.dll", "normal.dll"],
            ["folder\\escape.dll", "normal.dll"],
        ] {
            let root = tempdir().unwrap();
            let zip = root.path().join("runtime.zip");
            let stage = root.path().join("stage");
            fs::create_dir(&stage).unwrap();
            write_zip(&zip, &[(names[0], b"bad"), (names[1], b"bad")]);
            assert!(
                extract_runtime(&zip, Format::Zip, &stage, false, &AtomicBool::new(false)).is_err(),
                "accepted {names:?}"
            );
            assert!(!root.path().join("escape.dll").exists());
        }
    }

    fn write_tar_gz(path: &Path, files: &[(&str, &[u8], u32)], symlinks: &[(&str, &str)]) {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use tar::{Builder, EntryType, Header};
        let encoder = GzEncoder::new(File::create(path).unwrap(), Compression::default());
        let mut builder = Builder::new(encoder);
        for &(name, data, mode) in files {
            let mut header = Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(mode);
            header.set_entry_type(EntryType::Regular);
            builder.append_data(&mut header, name, data).unwrap();
        }
        for &(name, target) in symlinks {
            let mut header = Header::new_gnu();
            header.set_size(0);
            header.set_mode(0o777);
            header.set_entry_type(EntryType::Symlink);
            header.set_link_name(target).unwrap();
            builder
                .append_data(&mut header, name, std::io::empty())
                .unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn tar_gz_extraction_keeps_runtime_libraries_symlinks_and_notices() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempdir().unwrap();
        let tar = root.path().join("runtime.tar.gz");
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        write_tar_gz(
            &tar,
            &[
                ("llama-b11425/llama-server", b"server", 0o755),
                ("llama-b11425/libllama-server-impl.so", b"impl", 0o755),
                ("llama-b11425/libllama.so.0.5.0", b"lib", 0o755),
                ("llama-b11425/libggml-cpu-x64.so", b"cpu", 0o755),
                ("llama-b11425/LICENSE", b"license", 0o644),
                ("llama-b11425/llama-bench", b"tool", 0o755),
                ("llama-b11425/example.cpp", b"source", 0o644),
            ],
            &[
                ("llama-b11425/libllama.so", "libllama.so.0.5.0"),
                ("llama-b11425/libllama.so.0", "libllama.so.0.5.0"),
            ],
        );
        extract_runtime(&tar, Format::TarGz, &stage, false, &AtomicBool::new(false)).unwrap();
        assert!(stage.join("llama-server").is_file());
        assert!(stage.join("libllama-server-impl.so").is_file());
        assert!(stage.join("libggml-cpu-x64.so").is_file());
        assert!(!stage.join("llama-bench").exists());
        assert!(!stage.join("example.cpp").exists());
        assert_eq!(
            fs::read_link(stage.join("libllama.so")).unwrap(),
            PathBuf::from("libllama.so.0.5.0")
        );
        let notices = fs::read_dir(&stage)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|name| name.starts_with("llama-notice-"))
            .count();
        assert_eq!(notices, 1);
        assert_ne!(
            fs::metadata(stage.join("llama-server"))
                .unwrap()
                .permissions()
                .mode()
                & 0o111,
            0
        );
    }

    #[test]
    fn rejects_unsafe_archive_paths() {
        for path in [
            "../escape.so",
            "/absolute.so",
            "a/../../escape.so",
            "folder\\escape.so",
            "C:/escape.so",
        ] {
            assert!(
                validate_flat_name(Path::new(path)).is_err(),
                "accepted {path}"
            );
        }
        for target in [
            "../escape.so",
            "/absolute.so",
            "nested/lib.so",
            "folder\\lib.so",
            "C:/lib.so",
        ] {
            assert!(
                validate_symlink_target(Path::new(target)).is_err(),
                "accepted {target}"
            );
        }
        assert!(validate_flat_name(Path::new("llama-b11425/libllama.so")).is_ok());
        assert!(validate_symlink_target(Path::new("libllama.so.0.5.0")).is_ok());
    }

    #[test]
    fn rejects_duplicate_flattened_tar_names() {
        let root = tempdir().unwrap();
        let tar = root.path().join("runtime.tar.gz");
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        write_tar_gz(
            &tar,
            &[
                ("a/library.so", b"bad", 0o644),
                ("b/library.so", b"bad", 0o644),
            ],
            &[],
        );
        assert!(
            extract_runtime(&tar, Format::TarGz, &stage, false, &AtomicBool::new(false)).is_err()
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_tar_symlinks_that_escape_the_stage() {
        for target in ["../escape.so", "/absolute.so", "nested/lib.so"] {
            let root = tempdir().unwrap();
            let tar = root.path().join("runtime.tar.gz");
            let stage = root.path().join("stage");
            fs::create_dir(&stage).unwrap();
            write_tar_gz(
                &tar,
                &[("libgood.so", b"lib", 0o755)],
                &[("libbad.so", target)],
            );
            assert!(
                extract_runtime(&tar, Format::TarGz, &stage, false, &AtomicBool::new(false))
                    .is_err(),
                "accepted {target}"
            );
            assert!(!root.path().join("escape.so").exists());
        }
    }

    #[test]
    fn rejects_tar_hardlinks() {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use tar::{Builder, EntryType, Header};
        let root = tempdir().unwrap();
        let tar = root.path().join("runtime.tar.gz");
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        let encoder = GzEncoder::new(File::create(&tar).unwrap(), Compression::default());
        let mut builder = Builder::new(encoder);
        let mut header = Header::new_gnu();
        header.set_entry_type(EntryType::Link);
        header.set_size(0);
        header.set_link_name("libgood.so").unwrap();
        builder
            .append_data(&mut header, "liblink.so", std::io::empty())
            .unwrap();
        builder.into_inner().unwrap().finish().unwrap();
        assert!(
            extract_runtime(&tar, Format::TarGz, &stage, false, &AtomicBool::new(false)).is_err()
        );
    }

    #[test]
    fn incomplete_or_wrong_version_cache_is_never_ready() {
        let root = tempdir().unwrap();
        #[allow(unused_mut)]
        let mut files = required_files("cpu");
        #[cfg(all(windows, target_arch = "x86_64"))]
        files.push("ggml-cpu-x64.dll");
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        files.push("libggml-cpu-x64.so");
        for name in &files {
            fs::write(root.path().join(*name), b"binary").unwrap();
        }
        assert!(!installed(root.path(), "cpu"));
        let mut marker = Installed {
            version: VERSION.into(),
            backend: "cpu".into(),
            files: files.iter().map(|s| (*s).into()).collect(),
        };
        fs::write(
            root.path().join("installed.json"),
            serde_json::to_vec(&marker).unwrap(),
        )
        .unwrap();
        assert!(installed(root.path(), "cpu"));
        let missing = required_files("cpu")[1];
        fs::remove_file(root.path().join(missing)).unwrap();
        assert!(!installed(root.path(), "cpu"));
        fs::write(root.path().join(missing), b"binary").unwrap();
        marker.version = "other".into();
        fs::write(
            root.path().join("installed.json"),
            serde_json::to_vec(&marker).unwrap(),
        )
        .unwrap();
        assert!(!installed(root.path(), "cpu"));
        #[cfg(all(windows, target_arch = "x86_64"))]
        {
            assert!(check_required_files(root.path(), "cuda").is_err());
            assert!(check_required_files(root.path(), "vulkan").is_err());
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        assert!(check_required_files(root.path(), "vulkan").is_err());
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        assert!(check_required_files(root.path(), "metal").is_err());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn commits_after_a_transient_windows_file_lock_is_released() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = tempdir().unwrap();
        let stage = root.path().join("stage");
        let destination = root.path().join("ready");
        fs::create_dir(&stage).unwrap();
        let file = stage.join("server.dll");
        fs::write(&file, b"verified").unwrap();
        let handle = fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(file)
            .unwrap();
        assert!(fs::rename(&stage, &destination).is_err());
        let release = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(250)).await;
            drop(handle);
        });
        commit_installation(&stage, &destination, Arc::new(AtomicBool::new(false)))
            .await
            .unwrap();
        release.await.unwrap();
        assert_eq!(
            fs::read(destination.join("server.dll")).unwrap(),
            b"verified"
        );
        assert!(!stage.exists());
    }

    #[tokio::test]
    async fn corrupt_archive_is_removed_and_cancellation_keeps_partial_data() {
        let root = tempdir().unwrap();
        let path = root.path().join("runtime.zip");
        fs::write(&path, b"corrupt").unwrap();
        assert!(verify_archive(
            path.clone(),
            archives("cpu")[0].sha256.into(),
            Arc::new(AtomicBool::new(false))
        )
        .await
        .unwrap_err()
        .contains("SHA-256"));
        assert!(!path.exists());
        fs::write(&path, b"partial").unwrap();
        assert!(verify_archive(
            path.clone(),
            archives("cpu")[0].sha256.into(),
            Arc::new(AtomicBool::new(true))
        )
        .await
        .unwrap_err()
        .contains("cancelled"));
        assert!(path.exists());
    }

    async fn http(
        responses: Vec<(&'static str, &'static str, &'static [u8])>,
    ) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/runtime.zip", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            let mut requests = Vec::new();
            for (status, extra, body) in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = Vec::new();
                loop {
                    let mut bytes = [0; 1024];
                    let count = socket.read(&mut bytes).await.unwrap();
                    assert!(count > 0);
                    request.extend_from_slice(&bytes[..count]);
                    if request.windows(4).any(|w| w == b"\r\n\r\n") {
                        break;
                    }
                }
                requests.push(String::from_utf8_lossy(&request).to_ascii_lowercase());
                let header = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n",
                    body.len()
                );
                socket.write_all(header.as_bytes()).await.unwrap();
                socket.write_all(body).await.unwrap();
            }
            requests
        });
        (url, task)
    }

    const SMALL: Archive = Archive {
        name: "small.zip",
        bytes: 6,
        sha256: "unused",
        format: Format::Zip,
    };

    #[tokio::test]
    async fn resumes_download_at_validated_range() {
        let root = tempdir().unwrap();
        let path = root.path().join("partial");
        fs::write(&path, b"abc").unwrap();
        let (url, requests) = http(vec![(
            "206 Partial Content",
            "Content-Range: bytes 3-5/6\r\n",
            b"def",
        )])
        .await;
        download_archive(
            &reqwest::Client::new(),
            &url,
            &path,
            &SMALL,
            Arc::new(AtomicBool::new(false)),
            |_| {},
        )
        .await
        .unwrap();
        assert_eq!(fs::read(path).unwrap(), b"abcdef");
        assert!(requests.await.unwrap()[0].contains("range: bytes=3-"));
    }

    #[tokio::test]
    async fn restarts_if_server_ignores_or_rejects_range() {
        for reject in [false, true] {
            let root = tempdir().unwrap();
            let path = root.path().join("partial");
            fs::write(&path, b"old").unwrap();
            let mut responses = vec![];
            if reject {
                responses.push(("416 Range Not Satisfiable", "", &b""[..]));
            }
            responses.push(("200 OK", "", &b"abcdef"[..]));
            let (url, requests) = http(responses).await;
            download_archive(
                &reqwest::Client::new(),
                &url,
                &path,
                &SMALL,
                Arc::new(AtomicBool::new(false)),
                |_| {},
            )
            .await
            .unwrap();
            assert_eq!(fs::read(path).unwrap(), b"abcdef");
            let requests = requests.await.unwrap();
            assert!(requests[0].contains("range: bytes=3-"));
            if reject {
                assert!(!requests[1].contains("range:"));
            }
        }
    }

    #[tokio::test]
    async fn rejects_invalid_range_or_oversized_response() {
        for (status, extra, body) in [
            (
                "206 Partial Content",
                "Content-Range: bytes 0-5/6\r\n",
                &b"abcdef"[..],
            ),
            ("200 OK", "", &b"abcdefg"[..]),
        ] {
            let root = tempdir().unwrap();
            let path = root.path().join("partial");
            fs::write(&path, b"abc").unwrap();
            let (url, requests) = http(vec![(status, extra, body)]).await;
            assert!(download_archive(
                &reqwest::Client::new(),
                &url,
                &path,
                &SMALL,
                Arc::new(AtomicBool::new(false)),
                |_| {}
            )
            .await
            .is_err());
            assert!(!path.exists());
            requests.await.unwrap();
        }
    }

    #[tokio::test]
    async fn cancelled_download_does_not_connect_and_retains_partial_file() {
        let root = tempdir().unwrap();
        let path = root.path().join("partial");
        fs::write(&path, b"abc").unwrap();
        assert!(download_archive(
            &reqwest::Client::new(),
            "http://127.0.0.1:1",
            &path,
            &SMALL,
            Arc::new(AtomicBool::new(true)),
            |_| {}
        )
        .await
        .unwrap_err()
        .contains("cancelled"));
        assert_eq!(fs::read(path).unwrap(), b"abc");
    }

    #[tokio::test(start_paused = true)]
    async fn stalled_download_times_out_without_waiting_for_generation_timeout() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let root = tempdir().unwrap();
        let path = root.path().join("partial");
        let connected = Arc::new(Notify::new());
        let waiting = connected.clone();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 2048];
            assert!(socket.read(&mut request).await.unwrap() > 0);
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\n")
                .await
                .unwrap();
            waiting.notify_one();
            std::future::pending::<()>().await;
        });
        let download = {
            let path = path.clone();
            tokio::spawn(async move {
                download_archive(
                    &reqwest::Client::new(),
                    &url,
                    &path,
                    &SMALL,
                    Arc::new(AtomicBool::new(false)),
                    |_| {},
                )
                .await
            })
        };
        connected.notified().await;
        for _ in 0..20 {
            tokio::task::yield_now().await;
        }
        tokio::time::advance(Duration::from_secs(31)).await;
        let error = download.await.unwrap().unwrap_err();
        assert!(error.contains("stalled"), "{error}");
        server.abort();
    }

    #[tokio::test]
    async fn cancellation_interrupts_an_inflight_body_and_preserves_partial_bytes() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let root = tempdir().unwrap();
        let path = root.path().join("partial");
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 2048];
            assert!(socket.read(&mut request).await.unwrap() > 0);
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\nabc")
                .await
                .unwrap();
            std::future::pending::<()>().await;
        });
        let cancel = Arc::new(AtomicBool::new(false));
        let download = {
            let path = path.clone();
            let cancel = cancel.clone();
            tokio::spawn(async move {
                download_archive(&reqwest::Client::new(), &url, &path, &SMALL, cancel, |_| {}).await
            })
        };
        tokio::time::timeout(Duration::from_secs(5), async {
            while fs::metadata(&path).map(|m| m.len()).unwrap_or(0) < 3 {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        cancel.store(true, Ordering::SeqCst);
        assert!(tokio::time::timeout(Duration::from_secs(1), download)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err()
            .contains("cancelled"));
        assert_eq!(fs::read(path).unwrap(), b"abc");
        server.abort();
    }

    #[tokio::test]
    async fn concurrent_waiters_share_task_and_detaching_one_keeps_it_running() {
        let root = tempdir().unwrap();
        let manager = RuntimeManager::new(root.path().into());
        let started = Arc::new(Notify::new());
        let release = Arc::new(Notify::new());
        let count = Arc::new(AtomicUsize::new(0));
        let first = {
            let manager = manager.clone();
            let started = started.clone();
            let release = release.clone();
            let count = count.clone();
            tokio::spawn(async move {
                manager
                    .coordinate("model".into(), None, move |_, _| async move {
                        count.fetch_add(1, Ordering::SeqCst);
                        started.notify_one();
                        release.notified().await;
                        Ok(LocalRuntimeStatus {
                            phase: "running".into(),
                            ..Default::default()
                        })
                    })
                    .await
            })
        };
        started.notified().await;
        let second = {
            let manager = manager.clone();
            let count = count.clone();
            tokio::spawn(async move {
                manager
                    .coordinate("model".into(), None, move |_, _| async move {
                        count.fetch_add(1, Ordering::SeqCst);
                        Err("duplicate".into())
                    })
                    .await
            })
        };
        tokio::time::sleep(Duration::from_millis(20)).await;
        first.abort();
        // Status and cancellation controls do not require the preparation lock.
        assert_eq!(manager.status().phase, "idle");
        release.notify_one();
        assert_eq!(second.await.unwrap().unwrap().phase, "running");
        assert_eq!(count.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn explicit_cancel_notifies_all_waiters_and_preserves_failure_status() {
        let root = tempdir().unwrap();
        let manager = RuntimeManager::new(root.path().into());
        let started = Arc::new(Notify::new());
        let first = {
            let manager = manager.clone();
            let started = started.clone();
            tokio::spawn(async move {
                manager
                    .coordinate("model".into(), None, move |_, cancel| async move {
                        started.notify_one();
                        wait_cancel(cancel).await;
                        Err(CANCELLED.into())
                    })
                    .await
            })
        };
        started.notified().await;
        let second = {
            let manager = manager.clone();
            tokio::spawn(async move {
                manager
                    .coordinate("model".into(), None, |_, _| async {
                        panic!("duplicate operation")
                    })
                    .await
            })
        };
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(manager.cancel());
        assert!(first.await.unwrap().unwrap_err().contains("cancelled"));
        assert!(second.await.unwrap().unwrap_err().contains("cancelled"));
        assert_eq!(manager.status().phase, "cancelled");
        assert!(manager.status().error.is_some());
        assert!(manager.status().error.is_some());
    }

    #[tokio::test]
    async fn startup_failure_never_implicitly_tries_another_backend() {
        let root = tempdir().unwrap();
        let manager = RuntimeManager::new(root.path().into());
        let count = Arc::new(AtomicUsize::new(0));
        let calls = count.clone();
        let result = manager
            .coordinate(
                "model".into(),
                Some("cuda".into()),
                move |_, _| async move {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Err("CUDA startup failed".into())
                },
            )
            .await;
        assert_eq!(result.unwrap_err(), "CUDA startup failed");
        assert_eq!(count.load(Ordering::SeqCst), 1);
        assert_eq!(manager.status().phase, "failed");
        assert_eq!(
            manager.status().error.as_deref(),
            Some("CUDA startup failed")
        );
    }

    #[test]
    fn platform_resource_configuration_excludes_all_ai_binaries() {
        let shared: serde_json::Value =
            serde_json::from_str(include_str!("../../../tauri.conf.json")).unwrap();
        let windows: serde_json::Value =
            serde_json::from_str(include_str!("../../../tauri.windows.conf.json")).unwrap();
        assert!(shared["bundle"].get("resources").is_none());
        assert_eq!(
            windows["bundle"]["resources"],
            serde_json::json!(["resources/quicklook/**/*"])
        );
    }

    #[tokio::test]
    #[ignore = "requires official cpu fixture and stories260K.gguf in target/runtime-verification"]
    async fn official_runtime_installs_and_runs_inference() {
        let fixtures =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/runtime-verification");
        let backend =
            std::env::var("THEBERRY_TEST_RUNTIME_BACKEND").unwrap_or_else(|_| "cpu".into());
        assert!(["cpu", "cuda", "vulkan", "metal"].contains(&backend.as_str()));
        let model = fixtures.join("stories260K.gguf");
        let model_hash = "270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d";
        assert_eq!(
            hash_file(&model, &AtomicBool::new(false)).unwrap(),
            model_hash
        );
        let data = tempdir().unwrap();
        let manager = RuntimeManager::new(data.path().into());
        let root = manager.root();
        fs::create_dir_all(root.join("downloads")).unwrap();
        let cpu_archive = archives("cpu")[0];
        #[cfg(windows)]
        let cpu_fixture = "cpu.zip";
        #[cfg(not(windows))]
        let cpu_fixture = "cpu.tar.gz";
        for archive in archives(&backend) {
            let fixture = if archive.name == cpu_archive.name {
                fixtures.join(cpu_fixture)
            } else {
                fixtures.join(archive.name)
            };
            fs::copy(fixture, root.join("downloads").join(archive.name)).unwrap();
        }
        let detected = runtime_hardware::detect();
        println!("Detected compatible backends: {:?}", detected.backends());
        assert!(detected.backends().contains(&backend.as_str()));
        let status = manager
            .prepare_and_start(
                "smoke-model".into(),
                model,
                model_hash.into(),
                Some(backend.clone()),
                Arc::new(AtomicBool::new(false)),
            )
            .await
            .unwrap();
        assert!(status.is_running);
        assert_eq!(status.backend.as_deref(), Some(backend.as_str()));
        let key = install_key(&backend);
        assert!(installed(&root.join(key), key));
        assert!(root.join(key).join("LICENSE.llama.cpp").is_file());
        for archive in archives(&backend) {
            assert!(!root.join("downloads").join(archive.name).exists());
        }
        assert!(!root.join(format!(".{key}-staging")).exists());
        #[cfg(windows)]
        let tool = "llama-bench.exe";
        #[cfg(not(windows))]
        let tool = "llama-bench";
        assert!(!root.join(key).join(tool).exists());
        // With the source archive gone, a second install must use the committed cache.
        manager
            .ensure_installed(&root, &backend, Arc::new(AtomicBool::new(false)))
            .await
            .unwrap();
        let response = reqwest::Client::new().post(format!("http://127.0.0.1:{}/completion", status.port.unwrap())).timeout(Duration::from_secs(30)).json(&serde_json::json!({ "prompt": "Once upon a time", "n_predict": 8, "temperature": 0 })).send().await.unwrap();
        assert!(response.status().is_success());
        let body: serde_json::Value = response.json().await.unwrap();
        assert!(
            !body["content"].as_str().unwrap_or_default().is_empty(),
            "{body}"
        );
        println!("{backend} inference response: {}", body["content"]);
        manager.stop().await.unwrap();
        assert!(!manager.status().is_running);
    }
}

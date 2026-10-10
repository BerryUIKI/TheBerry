use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::process::{Child, Command};
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

const QWEN_REVISION: &str = "7fb011e9aee6e4dc7adf8430df9ea8de6a466aa3";
const QWEN_FILE: &str = "Qwen3-1.7B-Q4_K_M.gguf";
const QWEN_SHA256: &str = "228fb5627f7510b8b3516cdb6435e4b0d2a2bf330fe5b0ab19284a3570a8bb1f";
const DOWNLOAD_EVENT: &str = "goose://local-model-download";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModel {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub source: String,
    pub revision: String,
    pub source_url: String,
    pub license: String,
    pub hardware_requirements: String,
    pub tool_support: String,
    pub sha256: String,
    pub model_path: Option<String>,
    pub is_installed: bool,
    pub is_recommended: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalRuntimeStatus {
    pub is_running: bool,
    pub backend: Option<String>,
    pub port: Option<u16>,
    pub model_id: Option<String>,
    pub base_url: Option<String>,
    pub error: Option<String>,
}

impl Default for LocalRuntimeStatus {
    fn default() -> Self {
        Self {
            is_running: false,
            backend: None,
            port: None,
            model_id: None,
            base_url: None,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalModelDownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub is_complete: bool,
    pub is_cancelled: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelRecord {
    id: String,
    name: String,
    size_bytes: u64,
    source: String,
    revision: String,
    source_url: String,
    license: String,
    hardware_requirements: String,
    tool_support: String,
    sha256: String,
    model_path: String,
    is_recommended: bool,
}

#[derive(Debug, Clone, Copy)]
struct CatalogEntry {
    id: &'static str,
    name: &'static str,
    size_bytes: u64,
    source: &'static str,
    revision: &'static str,
    file_name: &'static str,
    license: &'static str,
    hardware_requirements: &'static str,
    tool_support: &'static str,
    sha256: &'static str,
}

const CATALOG: &[CatalogEntry] = &[CatalogEntry {
    id: "qwen3-1.7b-q4km",
    name: "Qwen3 1.7B · Q4_K_M",
    size_bytes: 1_110_000_000,
    source: "Qwen/Qwen3-1.7B-GGUF",
    revision: QWEN_REVISION,
    file_name: QWEN_FILE,
    license: "Apache-2.0",
    hardware_requirements: "4 GB RAM minimum; 6 GB recommended",
    tool_support: "verified",
    sha256: QWEN_SHA256,
}];

struct RuntimeState {
    child: Option<Child>,
    status: LocalRuntimeStatus,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            child: None,
            status: LocalRuntimeStatus::default(),
        }
    }
}

pub struct LocalInferenceManager {
    data_dir: parking_lot::RwLock<PathBuf>,
    runtime: AsyncMutex<RuntimeState>,
    downloads: Mutex<HashMap<String, Arc<AtomicBool>>>,
    http_client: reqwest::Client,
}

impl LocalInferenceManager {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir: parking_lot::RwLock::new(data_dir),
            runtime: AsyncMutex::new(RuntimeState::default()),
            downloads: Mutex::new(HashMap::new()),
            http_client: reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn set_data_dir(&self, data_dir: PathBuf) {
        *self.data_dir.write() = data_dir;
    }

    fn model_dir(&self) -> PathBuf {
        self.data_dir.read().join("local-models")
    }

    fn manifest_path(&self) -> PathBuf {
        self.model_dir().join("models.json")
    }

    fn catalog_model(entry: CatalogEntry, installed: Option<&ModelRecord>) -> LocalModel {
        let source_url = format!(
            "https://huggingface.co/{}/tree/{}",
            entry.source, entry.revision
        );
        LocalModel {
            id: entry.id.to_string(),
            name: entry.name.to_string(),
            size_bytes: entry.size_bytes,
            source: entry.source.to_string(),
            revision: entry.revision.to_string(),
            source_url,
            license: entry.license.to_string(),
            hardware_requirements: entry.hardware_requirements.to_string(),
            tool_support: entry.tool_support.to_string(),
            sha256: entry.sha256.to_string(),
            model_path: installed.map(|model| model.model_path.clone()),
            is_installed: installed.is_some_and(|model| Path::new(&model.model_path).is_file()),
            is_recommended: true,
        }
    }

    fn read_records(&self) -> Result<Vec<ModelRecord>, String> {
        let manifest_path = self.manifest_path();
        if !manifest_path.exists() {
            return Ok(Vec::new());
        }
        let contents = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Could not read local model catalog: {e}"))?;
        serde_json::from_str(&contents)
            .map_err(|e| format!("Could not parse local model catalog: {e}"))
    }

    fn save_records(&self, records: &[ModelRecord]) -> Result<(), String> {
        let model_dir = self.model_dir();
        let manifest_path = self.manifest_path();
        fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Could not create local model directory: {e}"))?;
        let temp_path = manifest_path.with_extension("json.tmp");
        let body = serde_json::to_vec_pretty(records)
            .map_err(|e| format!("Could not serialize local model catalog: {e}"))?;
        fs::write(&temp_path, body)
            .map_err(|e| format!("Could not write local model catalog: {e}"))?;
        if manifest_path.exists() {
            fs::remove_file(&manifest_path)
                .map_err(|e| format!("Could not replace local model catalog: {e}"))?;
        }
        fs::rename(&temp_path, &manifest_path)
            .map_err(|e| format!("Could not update local model catalog: {e}"))
    }

    pub fn list_models(&self) -> Result<Vec<LocalModel>, String> {
        let records = self.read_records()?;
        let mut result: Vec<LocalModel> = CATALOG
            .iter()
            .map(|entry| {
                Self::catalog_model(*entry, records.iter().find(|model| model.id == entry.id))
            })
            .collect();
        for record in records.iter().filter(|model| !model.is_recommended) {
            result.push(LocalModel {
                id: record.id.clone(),
                name: record.name.clone(),
                size_bytes: record.size_bytes,
                source: record.source.clone(),
                revision: record.revision.clone(),
                source_url: record.source_url.clone(),
                license: record.license.clone(),
                hardware_requirements: record.hardware_requirements.clone(),
                tool_support: record.tool_support.clone(),
                sha256: record.sha256.clone(),
                model_path: Some(record.model_path.clone()),
                is_installed: Path::new(&record.model_path).is_file(),
                is_recommended: false,
            });
        }
        Ok(result)
    }

    fn model_record(&self, model_id: &str) -> Result<ModelRecord, String> {
        self.read_records()?
            .into_iter()
            .find(|model| model.id == model_id)
            .ok_or_else(|| format!("Local model '{model_id}' is not installed."))
    }

    pub fn tool_support(&self, model_id: &str) -> Result<String, String> {
        Ok(self.model_record(model_id)?.tool_support)
    }

    pub async fn download_catalog_model(
        &self,
        app: AppHandle,
        model_id: &str,
    ) -> Result<(), String> {
        let entry = CATALOG
            .iter()
            .find(|entry| entry.id == model_id)
            .ok_or_else(|| format!("Unknown catalog model '{model_id}'."))?;
        let model_dir = self.model_dir();
        fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Could not create model directory: {e}"))?;

        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut downloads = self.downloads.lock().unwrap();
            if downloads.contains_key(model_id) {
                return Err("This model is already downloading.".to_string());
            }
            downloads.insert(model_id.to_string(), cancel.clone());
        }

        let result = self
            .download_catalog_model_inner(app.clone(), *entry, cancel)
            .await;
        self.downloads.lock().unwrap().remove(model_id);
        result
    }

    async fn download_catalog_model_inner(
        &self,
        app: AppHandle,
        entry: CatalogEntry,
        cancel: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let model_dir = self.model_dir();
        let part_path = model_dir.join(format!("{}.gguf.part", entry.id));
        let model_path = model_dir.join(format!("{}.gguf", entry.id));
        let offset = fs::metadata(&part_path).map(|meta| meta.len()).unwrap_or(0);
        let url = format!(
            "https://huggingface.co/{}/resolve/{}/{}",
            entry.source, entry.revision, entry.file_name
        );
        let mut request = self.http_client.get(url);
        if offset > 0 {
            request = request.header(reqwest::header::RANGE, format!("bytes={offset}-"));
        }
        let response = request
            .send()
            .await
            .map_err(|e| format!("Model download failed: {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "Model download failed with HTTP {}.",
                response.status()
            ));
        }

        let append = offset > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
        let already_downloaded = if append { offset } else { 0 };
        let total_bytes = response
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.rsplit('/').next())
            .and_then(|value| value.parse::<u64>().ok())
            .or_else(|| {
                response
                    .content_length()
                    .map(|length| length + already_downloaded)
            });
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(append)
            .truncate(!append)
            .open(&part_path)
            .await
            .map_err(|e| format!("Could not open model download file: {e}"))?;
        let mut downloaded = already_downloaded;
        let mut stream = response.bytes_stream();
        let mut last_emit = std::time::Instant::now();
        let _ = app.emit(
            DOWNLOAD_EVENT,
            LocalModelDownloadProgress {
                model_id: entry.id.to_string(),
                downloaded_bytes: downloaded,
                total_bytes,
                is_complete: false,
                is_cancelled: false,
                error: None,
            },
        );

        loop {
            if cancel.load(Ordering::Relaxed) {
                let _ = app.emit(
                    DOWNLOAD_EVENT,
                    LocalModelDownloadProgress {
                        model_id: entry.id.to_string(),
                        downloaded_bytes: downloaded,
                        total_bytes,
                        is_complete: false,
                        is_cancelled: true,
                        error: None,
                    },
                );
                return Ok(());
            }
            let next_chunk = tokio::select! {
                chunk = stream.next() => chunk,
                _ = tokio::time::sleep(Duration::from_millis(250)) => continue,
            };
            let Some(chunk) = next_chunk else { break };
            let chunk = chunk.map_err(|e| format!("Model download stream failed: {e}"))?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|e| format!("Could not write model download: {e}"))?;
            downloaded += chunk.len() as u64;
            if last_emit.elapsed() >= Duration::from_millis(150) {
                let _ = app.emit(
                    DOWNLOAD_EVENT,
                    LocalModelDownloadProgress {
                        model_id: entry.id.to_string(),
                        downloaded_bytes: downloaded,
                        total_bytes,
                        is_complete: false,
                        is_cancelled: false,
                        error: None,
                    },
                );
                last_emit = std::time::Instant::now();
            }
        }
        tokio::io::AsyncWriteExt::flush(&mut file)
            .await
            .map_err(|e| format!("Could not flush model download: {e}"))?;
        drop(file);

        let hash_path = part_path.clone();
        let actual_hash = tokio::task::spawn_blocking(move || sha256_file(&hash_path))
            .await
            .map_err(|e| format!("Model verification worker failed: {e}"))??;
        if actual_hash != entry.sha256 {
            let _ = fs::remove_file(&part_path);
            return Err(
                "The downloaded model failed SHA-256 verification and was removed.".to_string(),
            );
        }
        verify_gguf_header(&part_path)?;
        fs::rename(&part_path, &model_path)
            .map_err(|e| format!("Could not finalize downloaded model: {e}"))?;

        let mut records = self.read_records()?;
        records.retain(|model| model.id != entry.id);
        records.push(ModelRecord {
            id: entry.id.to_string(),
            name: entry.name.to_string(),
            size_bytes: fs::metadata(&model_path)
                .map(|meta| meta.len())
                .unwrap_or(entry.size_bytes),
            source: entry.source.to_string(),
            revision: entry.revision.to_string(),
            source_url: format!(
                "https://huggingface.co/{}/tree/{}",
                entry.source, entry.revision
            ),
            license: entry.license.to_string(),
            hardware_requirements: entry.hardware_requirements.to_string(),
            tool_support: entry.tool_support.to_string(),
            sha256: actual_hash,
            model_path: model_path.to_string_lossy().to_string(),
            is_recommended: true,
        });
        self.save_records(&records)?;
        let _ = app.emit(
            DOWNLOAD_EVENT,
            LocalModelDownloadProgress {
                model_id: entry.id.to_string(),
                downloaded_bytes: downloaded,
                total_bytes: Some(downloaded),
                is_complete: true,
                is_cancelled: false,
                error: None,
            },
        );
        Ok(())
    }

    pub fn cancel_download(&self, model_id: &str) -> bool {
        if let Some(cancel) = self.downloads.lock().unwrap().get(model_id) {
            cancel.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn import_model(&self, source_path: &str) -> Result<LocalModel, String> {
        let source = PathBuf::from(source_path);
        if !source.is_file() {
            return Err("Selected GGUF model file does not exist.".to_string());
        }
        verify_gguf_header(&source)?;
        let model_dir = self.model_dir();
        fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Could not create model directory: {e}"))?;
        let metadata =
            fs::metadata(&source).map_err(|e| format!("Could not read model file: {e}"))?;
        let sha256 = sha256_file(&source)?;
        let id = format!("imported-{}", Uuid::new_v4().simple());
        let model_path = model_dir.join(format!("{id}.gguf"));
        fs::copy(&source, &model_path)
            .map_err(|e| format!("Could not copy model into TheBerry storage: {e}"))?;
        let name = source
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Imported GGUF model")
            .to_string();
        let chat_template = read_chat_template(&model_path).unwrap_or_default();
        let tool_support = if chat_template.is_empty() {
            "unsupported"
        } else {
            "unverified"
        };
        let record = ModelRecord {
            id,
            name,
            size_bytes: metadata.len(),
            source: "Imported from local file".to_string(),
            revision: "local-import".to_string(),
            source_url: String::new(),
            license: "User supplied; check the model's license".to_string(),
            hardware_requirements: "Depends on model size and quantization".to_string(),
            tool_support: tool_support.to_string(),
            sha256,
            model_path: model_path.to_string_lossy().to_string(),
            is_recommended: false,
        };
        let mut records = self.read_records()?;
        records.push(record.clone());
        self.save_records(&records)?;
        Ok(LocalModel {
            id: record.id,
            name: record.name,
            size_bytes: record.size_bytes,
            source: record.source,
            revision: record.revision,
            source_url: record.source_url,
            license: record.license,
            hardware_requirements: record.hardware_requirements,
            tool_support: record.tool_support,
            sha256: record.sha256,
            model_path: Some(record.model_path),
            is_installed: true,
            is_recommended: false,
        })
    }

    pub async fn remove_model(&self, model_id: &str) -> Result<(), String> {
        let mut runtime = self.runtime.lock().await;
        if runtime.status.model_id.as_deref() == Some(model_id) {
            if let Some(mut child) = runtime.child.take() {
                let _ = child.kill().await;
            }
            runtime.status = LocalRuntimeStatus::default();
        }
        drop(runtime);

        let mut records = self.read_records()?;
        let record = records
            .iter()
            .find(|model| model.id == model_id)
            .cloned()
            .ok_or_else(|| format!("Local model '{model_id}' is not installed."))?;
        let path = PathBuf::from(&record.model_path);
        if !path.starts_with(self.model_dir()) {
            return Err(
                "Refusing to remove a model outside TheBerry's local model directory.".to_string(),
            );
        }
        fs::remove_file(&path).map_err(|e| format!("Could not remove model file: {e}"))?;
        records.retain(|model| model.id != model_id);
        self.save_records(&records)
    }

    pub async fn start(
        &self,
        resource_dir: Option<PathBuf>,
        model_id: &str,
    ) -> Result<LocalRuntimeStatus, String> {
        if !cfg!(all(target_os = "windows", target_arch = "x86_64")) {
            return Err(
                "The managed local provider is currently supported on Windows x64.".to_string(),
            );
        }
        let record = self.model_record(model_id)?;
        let model_path = PathBuf::from(&record.model_path);
        if !model_path.is_file() {
            return Err(
                "The selected GGUF file is missing. Import or download it again.".to_string(),
            );
        }
        let expected_hash = record.sha256.clone();
        let checked_path = model_path.clone();
        let actual_hash = tokio::task::spawn_blocking(move || sha256_file(&checked_path))
            .await
            .map_err(|e| format!("Model verification worker failed: {e}"))??;
        if actual_hash != expected_hash {
            return Err("The selected model failed SHA-256 verification. Remove it and import or download it again.".to_string());
        }
        verify_gguf_header(&model_path)?;

        let mut runtime = self.runtime.lock().await;
        if runtime.status.is_running && runtime.status.model_id.as_deref() == Some(model_id) {
            if let Some(child) = runtime.child.as_mut() {
                if child.try_wait().ok().flatten().is_none() {
                    return Ok(runtime.status.clone());
                }
            }
        }
        if let Some(mut child) = runtime.child.take() {
            let _ = child.kill().await;
        }
        runtime.status = LocalRuntimeStatus::default();

        let root = locate_runtime_root(resource_dir.as_deref());
        let Some(root) = root else {
            return Err("The bundled llama.cpp runtime is missing. Reinstall TheBerry or build with the managed runtime resources.".to_string());
        };
        let port =
            crate::modules::goose::process::GooseProcessManager::find_available_port(8000, 8999)
                .ok_or_else(|| "No available local inference port could be found.".to_string())?;
        let mut failures = Vec::new();

        for backend in ["cuda", "vulkan", "cpu"] {
            let backend_dir = root.join(backend);
            let binary = backend_dir.join("llama-server.exe");
            if !binary.is_file() {
                failures.push(format!("{backend}: binary not bundled"));
                continue;
            }
            let mut command = Command::new(&binary);
            command
                .current_dir(&backend_dir)
                .arg("--model")
                .arg(&model_path)
                .arg("--host")
                .arg("127.0.0.1")
                .arg("--port")
                .arg(port.to_string())
                .arg("--ctx-size")
                .arg("4096")
                .arg("--jinja")
                .arg("--alias")
                .arg(&record.id)
                .arg("--n-gpu-layers")
                .arg(if backend == "cpu" { "0" } else { "999" })
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            #[cfg(target_os = "windows")]
            command.creation_flags(0x08000000);

            let mut child = match command.spawn() {
                Ok(child) => child,
                Err(error) => {
                    failures.push(format!("{backend}: {error}"));
                    continue;
                }
            };
            let health_url = format!("http://127.0.0.1:{port}/health");
            let health_client = reqwest::Client::new();
            let started_at = tokio::time::Instant::now();
            let mut healthy = false;
            while started_at.elapsed() < Duration::from_secs(75) {
                if child.try_wait().ok().flatten().is_some() {
                    break;
                }
                if health_client
                    .get(&health_url)
                    .send()
                    .await
                    .is_ok_and(|response| response.status().is_success())
                {
                    healthy = true;
                    break;
                }
                tokio::time::sleep(Duration::from_millis(350)).await;
            }
            if healthy {
                runtime.status = LocalRuntimeStatus {
                    is_running: true,
                    backend: Some(backend.to_string()),
                    port: Some(port),
                    model_id: Some(record.id.clone()),
                    base_url: Some(format!("http://127.0.0.1:{port}/v1")),
                    error: None,
                };
                runtime.child = Some(child);
                return Ok(runtime.status.clone());
            }
            let _ = child.kill().await;
            failures.push(format!("{backend}: server did not become healthy"));
        }
        let error = format!(
            "Could not start llama.cpp with any backend. {}",
            failures.join("; ")
        );
        runtime.status.error = Some(error.clone());
        Err(error)
    }

    pub async fn status(&self) -> LocalRuntimeStatus {
        let mut runtime = self.runtime.lock().await;
        let running = runtime
            .child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_none());
        if !running {
            runtime.child = None;
            runtime.status = LocalRuntimeStatus::default();
        }
        runtime.status.clone()
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut runtime = self.runtime.lock().await;
        if let Some(mut child) = runtime.child.take() {
            child
                .kill()
                .await
                .map_err(|e| format!("Could not stop llama.cpp: {e}"))?;
        }
        runtime.status = LocalRuntimeStatus::default();
        Ok(())
    }
}

impl Drop for LocalInferenceManager {
    fn drop(&mut self) {
        if let Ok(mut runtime) = self.runtime.try_lock() {
            if let Some(child) = runtime.child.as_mut() {
                let _ = child.start_kill();
            }
        }
    }
}

fn locate_runtime_root(resource_dir: Option<&Path>) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(resource_dir) = resource_dir {
        candidates.push(resource_dir.join("resources").join("llama"));
        candidates.push(resource_dir.join("llama"));
    }
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("resources")
                .join("llama"),
        );
    }
    candidates.into_iter().find(|path| path.is_dir())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|e| format!("Could not open model for verification: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("Could not hash model file: {e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_gguf_header(path: &Path) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| format!("Could not open GGUF model: {e}"))?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic)
        .map_err(|_| "The selected file is too small to be a GGUF model.".to_string())?;
    if &magic != b"GGUF" {
        return Err("The selected file does not have the GGUF file signature.".to_string());
    }
    Ok(())
}

fn read_chat_template(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("Could not read GGUF metadata: {e}"))?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| e.to_string())?;
    if &magic != b"GGUF" {
        return Err("Not a GGUF file".to_string());
    }
    let _version = read_u32(&mut file)?;
    let _tensor_count = read_u64(&mut file)?;
    let metadata_count = read_u64(&mut file)?;
    if metadata_count > 1_000_000 {
        return Err("GGUF metadata count is unreasonable".to_string());
    }
    let mut chat_template = String::new();
    for _ in 0..metadata_count {
        let key = read_gguf_string(&mut file)?;
        let value_type = read_u32(&mut file)?;
        let value = if key == "tokenizer.chat_template" {
            read_gguf_string_value(&mut file, value_type)?
        } else {
            skip_gguf_value(&mut file, value_type)?;
            String::new()
        };
        if key == "tokenizer.chat_template" {
            chat_template = value;
        }
    }
    Ok(chat_template)
}

fn read_u32(reader: &mut impl Read) -> Result<u32, String> {
    let mut bytes = [0u8; 4];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_u64(reader: &mut impl Read) -> Result<u64, String> {
    let mut bytes = [0u8; 8];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_gguf_string(reader: &mut impl Read) -> Result<String, String> {
    let length = read_u64(reader)?;
    if length > 64 * 1024 * 1024 {
        return Err("GGUF metadata string is too large".to_string());
    }
    let mut bytes = vec![0u8; length as usize];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| format!("GGUF metadata is not UTF-8: {e}"))
}

fn read_gguf_string_value(
    reader: &mut (impl Read + Seek),
    value_type: u32,
) -> Result<String, String> {
    if value_type == 8 {
        return read_gguf_string(reader);
    }
    if value_type == 9 {
        let element_type = read_u32(reader)?;
        let count = read_u64(reader)?;
        if count > 100_000 {
            return Err("GGUF metadata array is too large".to_string());
        }
        let mut values = Vec::new();
        if element_type == 8 {
            for _ in 0..count {
                values.push(read_gguf_string(reader)?);
            }
        } else {
            for _ in 0..count {
                skip_gguf_value(reader, element_type)?;
            }
        }
        return Ok(values.join("\n"));
    }
    skip_gguf_value(reader, value_type)?;
    Ok(String::new())
}

fn skip_gguf_value(reader: &mut (impl Read + Seek), value_type: u32) -> Result<(), String> {
    let byte_length = match value_type {
        0 | 1 | 7 => 1,
        2 | 3 => 2,
        4 | 5 | 6 => 4,
        8 => {
            let length = read_u64(reader)?;
            if length > 1024 * 1024 * 1024 {
                return Err("GGUF metadata string is too large".to_string());
            }
            return reader
                .seek(SeekFrom::Current(length as i64))
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
        9 => {
            let element_type = read_u32(reader)?;
            let count = read_u64(reader)?;
            if count > 100_000_000 {
                return Err("GGUF metadata array is too large".to_string());
            }
            for _ in 0..count {
                skip_gguf_value(reader, element_type)?;
            }
            return Ok(());
        }
        10 | 11 | 12 => 8,
        other => return Err(format!("Unsupported GGUF metadata type {other}")),
    };
    reader
        .seek(SeekFrom::Current(byte_length))
        .map(|_| ())
        .map_err(|e| e.to_string())
}

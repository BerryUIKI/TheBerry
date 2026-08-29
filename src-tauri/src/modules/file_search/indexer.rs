use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub extension: String,
    pub modified_time: u64,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub pattern: String,
    pub search_root: Option<String>,
    pub max_results: Option<usize>,
    pub file_type_filter: Option<String>, // "all" | "file" | "dir" | "image" | "doc" | "code"
    pub case_sensitive: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct SystemDrive {
    pub name: String,
    pub path: String,
}

pub struct FileSearchEngine;

impl FileSearchEngine {
    pub fn get_available_drives() -> Vec<SystemDrive> {
        let mut drives = Vec::new();

        #[cfg(target_os = "windows")]
        {
            for letter in b'A'..=b'Z' {
                let drive_str = format!("{}:\\", letter as char);
                let path = PathBuf::from(&drive_str);
                if path.exists() {
                    drives.push(SystemDrive {
                        name: format!("Drive ({}:)", letter as char),
                        path: drive_str,
                    });
                }
            }
        }

        if let Some(user_home) = dirs::home_dir() {
            drives.insert(
                0,
                SystemDrive {
                    name: "User Home".to_string(),
                    path: user_home.to_string_lossy().to_string(),
                },
            );
        }

        if let Some(doc_dir) = dirs::document_dir() {
            drives.push(SystemDrive {
                name: "Documents".to_string(),
                path: doc_dir.to_string_lossy().to_string(),
            });
        }

        drives
    }

    pub fn search(query: SearchQuery) -> Vec<SearchResultItem> {
        let pattern_trimmed = query.pattern.trim();
        if pattern_trimmed.is_empty() {
            return Vec::new();
        }

        let max_results = query.max_results.unwrap_or(250);
        let case_sensitive = query.case_sensitive.unwrap_or(false);
        let pattern_cmp = if case_sensitive {
            pattern_trimmed.to_string()
        } else {
            pattern_trimmed.to_lowercase()
        };

        // Determine search root
        let root_path: PathBuf = if let Some(ref r) = query.search_root {
            if !r.trim().is_empty() {
                PathBuf::from(r)
            } else {
                dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
            }
        } else {
            dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
        };

        if !root_path.exists() {
            return Vec::new();
        }

        let mut results = Vec::new();

        let walker = WalkDir::new(&root_path)
            .follow_links(false)
            .max_depth(9)
            .into_iter()
            .filter_entry(|e| {
                let file_name = e.file_name().to_string_lossy();
                // Skip system hidden/recycle folders and heavy package directories
                !file_name.starts_with('$')
                    && file_name != "node_modules"
                    && file_name != ".git"
                    && file_name != "target"
                    && file_name != "AppData"
                    && file_name != "System Volume Information"
            });

        for entry in walker.filter_map(|e| e.ok()) {
            if results.len() >= max_results {
                break;
            }

            let path = entry.path();
            let file_name_str = entry.file_name().to_string_lossy();
            let check_name = if case_sensitive {
                file_name_str.to_string()
            } else {
                file_name_str.to_lowercase()
            };

            if check_name.contains(&pattern_cmp) {
                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let is_dir = metadata.is_dir();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                // Apply type filters
                if let Some(ref filter) = query.file_type_filter {
                    match filter.as_str() {
                        "dir" if !is_dir => continue,
                        "file" if is_dir => continue,
                        "image" => {
                            if !["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "tiff", "avif"].contains(&ext.as_str()) {
                                continue;
                            }
                        }
                        "code" => {
                            if !["rs", "ts", "tsx", "js", "jsx", "py", "go", "cpp", "c", "h", "html", "css", "json", "toml", "yaml", "md", "sql", "sh", "ps1", "bat"].contains(&ext.as_str()) {
                                continue;
                            }
                        }
                        "doc" => {
                            if !["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "csv"].contains(&ext.as_str()) {
                                continue;
                            }
                        }
                        _ => {}
                    }
                }

                let modified_time = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                results.push(SearchResultItem {
                    name: file_name_str.to_string(),
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    size_bytes: if is_dir { 0 } else { metadata.len() },
                    extension: ext,
                    modified_time,
                });
            }
        }

        results
    }

    pub fn reveal_in_explorer(path_str: &str) -> Result<(), String> {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            return Err("Target path does not exist".to_string());
        }

        #[cfg(target_os = "windows")]
        {
            if path.is_dir() {
                Command::new("explorer")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| format!("Failed to open folder: {}", e))?;
            } else {
                Command::new("explorer")
                    .args(["/select,", path.to_str().unwrap_or_default()])
                    .spawn()
                    .map_err(|e| format!("Failed to select file in explorer: {}", e))?;
            }
        }
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .args(["-R", path_str])
                .spawn()
                .map_err(|e| format!("Failed to reveal file: {}", e))?;
        }
        #[cfg(target_os = "linux")]
        {
            let parent = path.parent().unwrap_or(&path);
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open directory: {}", e))?;
        }

        Ok(())
    }
}

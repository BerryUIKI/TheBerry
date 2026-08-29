use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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

pub struct FileSearchEngine;

impl FileSearchEngine {
    pub fn search(query: SearchQuery) -> Vec<SearchResultItem> {
        let pattern_trimmed = query.pattern.trim();
        if pattern_trimmed.is_empty() {
            return Vec::new();
        }

        let max_results = query.max_results.unwrap_or(200);
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
            .max_depth(8)
            .into_iter()
            .filter_entry(|e| {
                let file_name = e.file_name().to_string_lossy();
                // Skip heavy cache or hidden system folders
                !file_name.starts_with('$')
                    && file_name != "node_modules"
                    && file_name != ".git"
                    && file_name != "target"
                    && file_name != "AppData"
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
                            if !["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].contains(&ext.as_str()) {
                                continue;
                            }
                        }
                        "code" => {
                            if !["rs", "ts", "tsx", "js", "jsx", "py", "go", "cpp", "c", "h", "html", "css", "json", "toml", "yaml", "md"].contains(&ext.as_str()) {
                                continue;
                            }
                        }
                        "doc" => {
                            if !["pdf", "docx", "doc", "xlsx", "pptx", "txt", "md", "csv"].contains(&ext.as_str()) {
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
}

use super::model::{FileInfo, PathFilter};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use walkdir::WalkDir;

pub struct Scanner;

impl Scanner {
    pub fn is_match_wildcard(pattern: &str, text: &str) -> bool {
        let p: Vec<char> = pattern.to_lowercase().chars().collect();
        let t: Vec<char> = text.to_lowercase().chars().collect();
        let (p_len, t_len) = (p.len(), t.len());

        let mut dp = vec![vec![false; t_len + 1]; p_len + 1];
        dp[0][0] = true;

        for i in 1..=p_len {
            if p[i - 1] == '*' {
                dp[i][0] = dp[i - 1][0];
            }
        }

        for i in 1..=p_len {
            for j in 1..=t_len {
                if p[i - 1] == '*' {
                    dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
                } else if p[i - 1] == '?' || p[i - 1] == t[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1];
                }
            }
        }

        dp[p_len][t_len]
    }

    pub fn matches_pattern(rel_path: &str, pattern: &str) -> bool {
        let norm_path = rel_path.replace('\\', "/");
        let norm_pattern = pattern.replace('\\', "/").trim().to_string();

        if norm_pattern.is_empty() {
            return false;
        }

        // If pattern contains slash, match whole relative path (or prefix/suffix)
        if norm_pattern.contains('/') {
            let clean_pat = norm_pattern.trim_matches('/');
            let clean_path = norm_path.trim_matches('/');
            if norm_pattern.ends_with('/') || norm_pattern.ends_with("/*") {
                let dir_pat = norm_pattern.trim_end_matches("/*").trim_end_matches('/');
                if clean_path == dir_pat || clean_path.starts_with(&format!("{}/", dir_pat)) {
                    return true;
                }
            }
            Self::is_match_wildcard(&norm_pattern, &norm_path)
                || Self::is_match_wildcard(clean_pat, clean_path)
        } else {
            // Pattern has no slashes (e.g. *.tmp, Thumbs.db), match against filename
            let filename = norm_path.rsplit('/').next().unwrap_or(&norm_path);
            Self::is_match_wildcard(&norm_pattern, filename)
        }
    }

    pub fn is_excluded(rel_path: &str, size_bytes: u64, is_dir: bool, filter: &PathFilter) -> bool {
        if is_dir {
            // For directories, check if any exclude pattern matches directory name or path
            for pat in &filter.exclude_patterns {
                if Self::matches_pattern(rel_path, pat) {
                    return true;
                }
            }
            return false;
        }

        // Check size constraints
        if let Some(min_size) = filter.min_size_bytes {
            if size_bytes < min_size {
                return true;
            }
        }
        if let Some(max_size) = filter.max_size_bytes {
            if size_bytes > max_size {
                return true;
            }
        }

        // Check exclude patterns
        for pat in &filter.exclude_patterns {
            if Self::matches_pattern(rel_path, pat) {
                return true;
            }
        }

        // Check include patterns (if any specified)
        if !filter.include_patterns.is_empty() {
            let mut included = false;
            for pat in &filter.include_patterns {
                if pat == "*" || Self::matches_pattern(rel_path, pat) {
                    included = true;
                    break;
                }
            }
            if !included {
                return true;
            }
        }

        false
    }

    pub fn compute_sha256(file_path: &Path) -> Result<String, String> {
        let file = File::open(file_path).map_err(|e| format!("Failed to open file for hashing: {}", e))?;
        let mut reader = BufReader::with_capacity(64 * 1024, file);
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];

        loop {
            let n = reader.read(&mut buffer).map_err(|e| format!("Read error during hashing: {}", e))?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn scan_directory(
        root_path: &Path,
        filter: &PathFilter,
        compute_hash: bool,
    ) -> Result<HashMap<String, FileInfo>, String> {
        if !root_path.exists() {
            return Err(format!("Directory does not exist: {}", root_path.display()));
        }
        if !root_path.is_dir() {
            return Err(format!("Path is not a directory: {}", root_path.display()));
        }

        let mut map = HashMap::new();
        let walker = WalkDir::new(root_path).follow_links(false);

        for entry in walker.into_iter().filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let rel = match e.path().strip_prefix(root_path) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => return false,
            };
            let is_dir = e.file_type().is_dir();
            !Self::is_excluded(&rel, 0, is_dir, filter)
        }) {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!("Scan entry error: {}", e);
                    continue;
                }
            };

            if entry.depth() == 0 {
                continue;
            }

            let rel_path = match entry.path().strip_prefix(root_path) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    tracing::warn!("Failed to read metadata for {}: {}", entry.path().display(), e);
                    continue;
                }
            };

            let is_dir = metadata.is_dir();
            let size_bytes = if is_dir { 0 } else { metadata.len() };

            if Self::is_excluded(&rel_path, size_bytes, is_dir, filter) {
                continue;
            }

            let modified_timestamp_secs = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            let hash = if !is_dir && compute_hash {
                Self::compute_sha256(entry.path()).ok()
            } else {
                None
            };

            map.insert(
                rel_path.clone(),
                FileInfo {
                    relative_path: rel_path,
                    size_bytes,
                    modified_timestamp_secs,
                    is_dir,
                    hash,
                },
            );
        }

        Ok(map)
    }
}

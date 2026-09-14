use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameItem {
    pub original_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRenameResult {
    pub total: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub errors: Vec<String>,
}

pub fn execute_batch_rename(items: &[RenameItem]) -> BatchRenameResult {
    let total = items.len();
    let mut success_count = 0;
    let mut failure_count = 0;
    let mut errors = Vec::new();

    for item in items {
        let src = Path::new(&item.original_path);
        let dst = Path::new(&item.new_path);

        if !src.exists() {
            failure_count += 1;
            errors.push(format!("Source does not exist: {}", item.original_path));
            continue;
        }

        if src == dst {
            success_count += 1;
            continue;
        }

        if dst.exists() {
            // Check if it is a case-only rename on Windows/case-insensitive filesystem
            let is_case_only = src.canonicalize().ok() == dst.canonicalize().ok();
            if !is_case_only {
                failure_count += 1;
                errors.push(format!("Target already exists: {}", item.new_path));
                continue;
            }
        }

        // Attempt rename
        if let Err(e) = fs::rename(src, dst) {
            // If case-only rename fails directly, use temporary file intermediate rename
            let mut renamed = false;
            if let Some(_parent) = src.parent() {
                let temp_name = format!("{}.berry_tmp_{}", item.original_path, uuid::Uuid::new_v4().simple());
                let temp_path = PathBuf::from(&temp_name);
                if fs::rename(src, &temp_path).is_ok() {
                    if fs::rename(&temp_path, dst).is_ok() {
                        renamed = true;
                    } else {
                        let _ = fs::rename(&temp_path, src);
                    }
                }
            }

            if renamed {
                success_count += 1;
            } else {
                failure_count += 1;
                errors.push(format!("Failed to rename '{}' -> '{}': {}", item.original_path, item.new_path, e));
            }
        } else {
            success_count += 1;
        }
    }

    BatchRenameResult {
        total,
        success_count,
        failure_count,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_execute_batch_rename() {
        let dir = tempdir().expect("temp dir");
        let file_a = dir.path().join("alpha.txt");
        let file_b = dir.path().join("beta.txt");
        File::create(&file_a).unwrap();
        File::create(&file_b).unwrap();

        let new_a = dir.path().join("alpha_renamed.txt");
        let new_b = dir.path().join("beta_renamed.txt");

        let items = vec![
            RenameItem {
                original_path: file_a.to_string_lossy().to_string(),
                new_path: new_a.to_string_lossy().to_string(),
            },
            RenameItem {
                original_path: file_b.to_string_lossy().to_string(),
                new_path: new_b.to_string_lossy().to_string(),
            },
        ];

        let res = execute_batch_rename(&items);
        assert_eq!(res.success_count, 2);
        assert_eq!(res.failure_count, 0);
        assert!(new_a.exists());
        assert!(new_b.exists());
        assert!(!file_a.exists());
        assert!(!file_b.exists());
    }
}

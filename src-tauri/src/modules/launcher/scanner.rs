use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredApp {
    pub name: String,
    pub exec_path: String,
    pub category: String,
    pub icon_hint: Option<String>,
}

pub struct AppScanner;

impl AppScanner {
    pub fn scan_start_menu_apps() -> Vec<DiscoveredApp> {
        let mut apps = Vec::new();
        let mut seen_paths = HashSet::new();

        let mut search_dirs: Vec<PathBuf> = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Some(appdata) = dirs::data_dir() {
                search_dirs.push(
                    appdata
                        .join("Microsoft")
                        .join("Windows")
                        .join("Start Menu")
                        .join("Programs"),
                );
            }
            let program_data = PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs");
            if program_data.exists() {
                search_dirs.push(program_data);
            }
        }

        #[cfg(target_os = "macos")]
        {
            search_dirs.push(PathBuf::from("/Applications"));
            if let Some(home) = dirs::home_dir() {
                search_dirs.push(home.join("Applications"));
            }
        }

        #[cfg(target_os = "linux")]
        {
            search_dirs.push(PathBuf::from("/usr/share/applications"));
            if let Some(home) = dirs::home_dir() {
                search_dirs.push(home.join(".local/share/applications"));
            }
        }

        for dir in search_dirs {
            if !dir.exists() {
                continue;
            }

            for entry in WalkDir::new(&dir)
                .follow_links(false)
                .max_depth(5)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                if ["lnk", "exe", "app", "desktop"].contains(&ext.as_str()) {
                    let file_stem = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .trim();

                    if file_stem.is_empty()
                        || file_stem.to_lowercase().contains("uninstall")
                        || file_stem.to_lowercase().contains("setup")
                        || file_stem.to_lowercase().starts_with("help")
                    {
                        continue;
                    }

                    let path_str = path.to_string_lossy().to_string();
                    if seen_paths.insert(path_str.clone()) {
                        let category = Self::guess_category(file_stem, path);
                        apps.push(DiscoveredApp {
                            name: file_stem.to_string(),
                            exec_path: path_str,
                            category,
                            icon_hint: None,
                        });
                    }
                }
            }
        }

        // Sort alphabetically
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        apps
    }

    fn guess_category(name: &str, _path: &Path) -> String {
        let lower = name.to_lowercase();
        if lower.contains("code")
            || lower.contains("studio")
            || lower.contains("git")
            || lower.contains("terminal")
            || lower.contains("powershell")
            || lower.contains("intellij")
            || lower.contains("rust")
            || lower.contains("vim")
        {
            "Development".to_string()
        } else if lower.contains("chrome")
            || lower.contains("edge")
            || lower.contains("firefox")
            || lower.contains("browser")
            || lower.contains("postman")
        {
            "Browsers & Web".to_string()
        } else if lower.contains("wechat")
            || lower.contains("slack")
            || lower.contains("discord")
            || lower.contains("telegram")
            || lower.contains("teams")
            || lower.contains("dingtalk")
            || lower.contains("qq")
        {
            "Communication".to_string()
        } else if lower.contains("photoshop")
            || lower.contains("figma")
            || lower.contains("illustrator")
            || lower.contains("premiere")
            || lower.contains("blender")
        {
            "Design & Creative".to_string()
        } else if lower.contains("word")
            || lower.contains("excel")
            || lower.contains("powerpoint")
            || lower.contains("notion")
            || lower.contains("obsidian")
        {
            "Productivity".to_string()
        } else {
            "Applications".to_string()
        }
    }
}

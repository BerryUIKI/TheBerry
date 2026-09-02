#![cfg(target_os = "windows")]

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::types::{QuickLookPreviewPayload, QuickLookStatus};

pub struct QuickLookService;

impl QuickLookService {
    /// Resolves current Windows User SID
    pub fn get_user_sid() -> Option<String> {
        let output = Command::new("whoami")
            .arg("/user")
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let line = line.trim();
            if line.starts_with("S-1-") || line.contains(" S-1-") {
                // Extract token starting with S-1-
                for part in line.split_whitespace() {
                    if part.starts_with("S-1-") {
                        return Some(part.to_string());
                    }
                }
            }
        }
        None
    }

    /// Constructs the Named Pipe path for QuickLook
    pub fn get_pipe_path() -> Option<String> {
        let sid = Self::get_user_sid()?;
        Some(format!(r"\\.\pipe\QuickLook.App.Pipe.{}", sid))
    }

    /// Discovers QuickLook.exe executable path
    pub fn discover_binary() -> Option<PathBuf> {
        // 1. Check PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let candidate = dir.join("QuickLook.exe");
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        // 2. Check standard installation directories
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let candidate = Path::new(&local_app_data)
                .join("Programs")
                .join("QuickLook")
                .join("QuickLook.exe");
            if candidate.is_file() {
                return Some(candidate);
            }
        }

        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            let candidate = Path::new(&prog_files)
                .join("QuickLook")
                .join("QuickLook.exe");
            if candidate.is_file() {
                return Some(candidate);
            }
        }

        if let Ok(prog_files_x86) = std::env::var("ProgramFiles(x86)") {
            let candidate = Path::new(&prog_files_x86)
                .join("QuickLook")
                .join("QuickLook.exe");
            if candidate.is_file() {
                return Some(candidate);
            }
        }

        None
    }

    /// Gets current QuickLook status on Windows
    pub fn get_status() -> QuickLookStatus {
        let pipe_path = Self::get_pipe_path();
        let binary_path = Self::discover_binary();

        // Check if pipe is currently accessible
        let mut is_running = false;
        if let Some(ref p) = pipe_path {
            if let Ok(_) = OpenOptions::new().write(true).open(p) {
                is_running = true;
            }
        }

        let is_installed = binary_path.is_some() || is_running;

        QuickLookStatus {
            is_supported_os: true,
            is_installed,
            is_running,
            binary_path: binary_path.map(|p| p.to_string_lossy().to_string()),
            pipe_name: pipe_path,
            error_message: if !is_installed {
                Some("QuickLook is not detected. Please install QuickLook from GitHub or Microsoft Store.".to_string())
            } else {
                None
            },
        }
    }

    /// Sends a message via Windows Named Pipe
    fn send_pipe_message(message_name: &str, file_path: &str) -> Result<(), String> {
        let pipe_path = Self::get_pipe_path()
            .ok_or_else(|| "Failed to resolve Windows User SID for QuickLook pipe.".to_string())?;

        let mut file = OpenOptions::new()
            .write(true)
            .open(&pipe_path)
            .map_err(|e| format!("Could not connect to QuickLook pipe: {}", e))?;

        let payload = format!("{}|{}\n", message_name, file_path);
        file.write_all(payload.as_bytes())
            .map_err(|e| format!("Failed to write to QuickLook pipe: {}", e))?;
        file.flush()
            .map_err(|e| format!("Failed to flush QuickLook pipe: {}", e))?;

        Ok(())
    }

    /// Triggers preview for target file (Toggle, Switch, or Preview)
    pub fn preview(payload: QuickLookPreviewPayload) -> Result<bool, String> {
        let path = Path::new(&payload.path);
        if !path.exists() {
            return Err(format!("File does not exist: {}", payload.path));
        }

        let abs_path = path.canonicalize()
            .unwrap_or_else(|_| path.to_path_buf())
            .to_string_lossy()
            .to_string();

        let message_type = match payload.mode.as_deref() {
            Some("switch") => "QuickLook.App.PipeMessages.Switch",
            Some("show") | Some("preview") => "QuickLook.App.PipeMessages.Toggle",
            Some("close") => "QuickLook.App.PipeMessages.Close",
            _ => "QuickLook.App.PipeMessages.Toggle",
        };

        // Try primary channel: Named Pipe
        if let Ok(()) = Self::send_pipe_message(message_type, &abs_path) {
            return Ok(true);
        }

        // Secondary fallback: CLI Process execution
        if let Some(bin_path) = Self::discover_binary() {
            let mut cmd = Command::new(&bin_path);
            cmd.arg(&abs_path);
            if let Ok(_) = cmd.spawn() {
                return Ok(true);
            }
        }

        Err("Failed to trigger QuickLook preview. Ensure QuickLook is running.".to_string())
    }

    /// Closes any active QuickLook preview window
    pub fn close() -> Result<(), String> {
        let _ = Self::send_pipe_message("QuickLook.App.PipeMessages.Close", "");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_sid_resolution() {
        let sid = QuickLookService::get_user_sid();
        assert!(sid.is_some(), "Should resolve user SID on Windows");
        let sid_str = sid.unwrap();
        assert!(sid_str.starts_with("S-1-"), "SID should start with S-1-");
    }

    #[test]
    fn test_pipe_path_format() {
        let pipe_path = QuickLookService::get_pipe_path();
        assert!(pipe_path.is_some(), "Pipe path should be generated");
        let path = pipe_path.unwrap();
        assert!(path.starts_with(r"\\.\pipe\QuickLook.App.Pipe.S-1-"));
    }
}

use std::env;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::fs;
use std::path::PathBuf;
use std::process::Command;

pub struct AutostartService;

impl AutostartService {
    pub const APP_NAME: &str = "TheBerry";

    /// Checks whether the application is configured to launch on system boot
    pub fn is_enabled() -> Result<bool, String> {
        #[cfg(target_os = "windows")]
        {
            let output = Command::new("reg")
                .args([
                    "query",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    Self::APP_NAME,
                ])
                .output()
                .map_err(|e| format!("Failed to query Windows registry: {}", e))?;

            Ok(output.status.success())
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(home) = dirs::home_dir() {
                let plist_path = home
                    .join("Library")
                    .join("LaunchAgents")
                    .join(format!("com.berryuiki.{}.plist", Self::APP_NAME.to_lowercase()));
                Ok(plist_path.exists())
            } else {
                Ok(false)
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(config_dir) = dirs::config_dir() {
                let desktop_file = config_dir
                    .join("autostart")
                    .join(format!("{}.desktop", Self::APP_NAME.to_lowercase()));
                Ok(desktop_file.exists())
            } else {
                Ok(false)
            }
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Ok(false)
        }
    }

    /// Enables launching on system boot
    pub fn enable(custom_path: Option<&str>) -> Result<(), String> {
        let exe_path: PathBuf = match custom_path {
            Some(p) => PathBuf::from(p),
            None => env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))?,
        };

        let exe_str = exe_path.to_string_lossy().to_string();

        #[cfg(target_os = "windows")]
        {
            let status = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    Self::APP_NAME,
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_str),
                    "/f",
                ])
                .status()
                .map_err(|e| format!("Failed to modify Windows registry: {}", e))?;

            if !status.success() {
                return Err("Registry add command returned non-zero exit code".to_string());
            }

            Ok(())
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(home) = dirs::home_dir() {
                let agents_dir = home.join("Library").join("LaunchAgents");
                let _ = fs::create_dir_all(&agents_dir);
                let plist_path = agents_dir.join(format!("com.berryuiki.{}.plist", Self::APP_NAME.to_lowercase()));

                let plist_content = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.berryuiki.{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#,
                    Self::APP_NAME.to_lowercase(),
                    exe_str
                );

                fs::write(plist_path, plist_content).map_err(|e| format!("Failed to write LaunchAgent: {}", e))?;
                Ok(())
            } else {
                Err("Home directory not found".to_string())
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(config_dir) = dirs::config_dir() {
                let autostart_dir = config_dir.join("autostart");
                let _ = fs::create_dir_all(&autostart_dir);
                let desktop_path = autostart_dir.join(format!("{}.desktop", Self::APP_NAME.to_lowercase()));

                let desktop_content = format!(
                    "[Desktop Entry]\nType=Application\nName={}\nExec={}\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\n",
                    Self::APP_NAME,
                    exe_str
                );

                fs::write(desktop_path, desktop_content).map_err(|e| format!("Failed to write autostart desktop file: {}", e))?;
                Ok(())
            } else {
                Err("Config directory not found".to_string())
            }
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err("Autostart is not supported on this platform".to_string())
        }
    }

    /// Disables launching on system boot
    pub fn disable() -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            let status = Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    Self::APP_NAME,
                    "/f",
                ])
                .status()
                .map_err(|e| format!("Failed to delete from Windows registry: {}", e))?;

            // If key doesn't exist, it's considered successfully disabled
            let _ = status;
            Ok(())
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(home) = dirs::home_dir() {
                let plist_path = home
                    .join("Library")
                    .join("LaunchAgents")
                    .join(format!("com.berryuiki.{}.plist", Self::APP_NAME.to_lowercase()));
                if plist_path.exists() {
                    let _ = fs::remove_file(plist_path);
                }
            }
            Ok(())
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(config_dir) = dirs::config_dir() {
                let desktop_path = config_dir
                    .join("autostart")
                    .join(format!("{}.desktop", Self::APP_NAME.to_lowercase()));
                if desktop_path.exists() {
                    let _ = fs::remove_file(desktop_path);
                }
            }
            Ok(())
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Ok(())
        }
    }
}

use std::path::{Path, PathBuf};

/// Get the bootstrap config directory where the primary pointer config is located.
/// Standard bootstrap location: User's home / .theberry / bootstrap.toml or user profile.
pub fn get_bootstrap_dir() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        home.join(".theberry")
    } else {
        PathBuf::from(".theberry")
    }
}

/// Get the bootstrap config file path (`~/.theberry/bootstrap.toml`)
pub fn get_bootstrap_config_path() -> PathBuf {
    get_bootstrap_dir().join("bootstrap.toml")
}

/// Get the default recommended custom data directory: `<Documents>/BerryAppData`
pub fn get_suggested_data_dir() -> PathBuf {
    if let Some(doc_dir) = dirs::document_dir() {
        doc_dir.join("BerryAppData")
    } else if let Some(home) = dirs::home_dir() {
        home.join("Documents").join("BerryAppData")
    } else {
        PathBuf::from("BerryAppData")
    }
}

/// Verify if a target directory can be created and written to
pub fn ensure_directory_exists(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}

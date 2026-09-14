use md5::Md5;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChecksums {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub sha512: String,
}

pub fn calculate_file_checksums<P: AsRef<Path>>(path: P) -> Result<FileChecksums, String> {
    let path_ref = path.as_ref();
    if !path_ref.exists() {
        return Err(format!("File does not exist: {}", path_ref.display()));
    }
    if !path_ref.is_file() {
        return Err(format!("Path is not a regular file: {}", path_ref.display()));
    }

    let file = File::open(path_ref).map_err(|e| format!("Failed to open file: {}", e))?;
    let metadata = file.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
    let file_size = metadata.len();
    let file_name = path_ref
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let file_path = path_ref.to_string_lossy().to_string();

    let mut reader = BufReader::with_capacity(1024 * 1024, file);

    let mut md5_hasher = Md5::new();
    let mut sha1_hasher = Sha1::new();
    let mut sha256_hasher = Sha256::new();
    let mut sha512_hasher = Sha512::new();

    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file chunk: {}", e))?;
        if bytes_read == 0 {
            break;
        }

        let chunk = &buffer[..bytes_read];
        md5_hasher.update(chunk);
        sha1_hasher.update(chunk);
        sha256_hasher.update(chunk);
        sha512_hasher.update(chunk);
    }

    let md5_res = format!("{:x}", md5_hasher.finalize());
    let sha1_res = format!("{:x}", sha1_hasher.finalize());
    let sha256_res = format!("{:x}", sha256_hasher.finalize());
    let sha512_res = format!("{:x}", sha512_hasher.finalize());

    Ok(FileChecksums {
        file_path,
        file_name,
        file_size,
        md5: md5_res,
        sha1: sha1_res,
        sha256: sha256_res,
        sha512: sha512_res,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_calculate_file_checksums() {
        let mut temp_file = NamedTempFile::new().expect("create temp file");
        write!(temp_file, "hello the-berry hash calculation test").expect("write test content");
        let path = temp_file.path();

        let checksums = calculate_file_checksums(path).expect("calculate checksums");
        assert_eq!(checksums.file_size, 37);
        assert_eq!(checksums.md5.len(), 32);
        assert_eq!(checksums.sha1.len(), 40);
        assert_eq!(checksums.sha256.len(), 64);
        assert_eq!(checksums.sha512.len(), 128);
    }
}

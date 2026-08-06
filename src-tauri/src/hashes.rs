use std::fmt::Write;
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

use md5::Md5;
use sha2::{Digest, Sha256};
use tauri::ipc::{InvokeBody, Request};

fn to_hex(digest: &[u8]) -> String {
    let mut hex = String::with_capacity(digest.len() * 2);

    for byte in digest {
        let _ = write!(hex, "{:02x}", byte);
    }

    hex
}

fn get_raw_body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err(
            "Expected a raw bytes payload ('Uint8Array'), got JSON".to_string(),
        ),
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    to_hex(&Sha256::digest(bytes))
}

// Streams a file through SHA256 instead of reading it fully into memory
pub fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(to_hex(&hasher.finalize()))
}

#[tauri::command]
pub fn hash_sha256(request: Request<'_>) -> Result<String, String> {
    let bytes = get_raw_body(&request)?;

    Ok(sha256_hex(bytes))
}

#[tauri::command]
pub fn hash_md5(request: Request<'_>) -> Result<String, String> {
    let bytes = get_raw_body(&request)?;

    Ok(to_hex(&Md5::digest(bytes)))
}

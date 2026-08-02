use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;
use zip::ZipArchive;

use crate::hashes::sha256_hex;

const METADATA_ENTRY: &str = "metadata.json";
const CODE_ENTRY: &str = "index.js";

const MAX_METADATA_SIZE: u64 = 64 * 1024;
const MAX_CODE_SIZE: u64 = 16 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFile {
    pub file_name: String,
    pub metadata: serde_json::Value,
    pub code: String,
    pub code_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFailure {
    pub file_name: String,
    pub error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsReadResult {
    pub extensions: Vec<ExtensionFile>,
    pub failures: Vec<ExtensionFailure>,
}

fn is_extension_archive(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };

    extension.eq_ignore_ascii_case("zip") || extension.eq_ignore_ascii_case("kaede")
}

fn read_entry_text(
    archive: &mut ZipArchive<File>,
    entry_name: &str,
    max_size: u64,
) -> Result<String, String> {
    let entry = archive
        .by_name(entry_name)
        .map_err(|error| format!("Could not find '{}' at the archive root: {}", entry_name, error))?;
    let declared_size = entry.size();

    if declared_size > max_size {
        return Err(format!(
            "'{}' declares {} bytes which exceeds the {} bytes limit",
            entry_name, declared_size, max_size,
        ));
    }

    let mut contents = String::new();
    let mut limited_reader = entry.take(max_size + 1);

    limited_reader
        .read_to_string(&mut contents)
        .map_err(|error| format!("Could not read '{}' as UTF-8 text: {}", entry_name, error))?;

    if contents.len() as u64 > max_size {
        return Err(format!(
            "'{}' decompressed past the {} bytes limit",
            entry_name, max_size,
        ));
    }

    // Strip the UTF-8 BOM
    if contents.starts_with('\u{feff}') {
        contents.remove(0);
    }

    Ok(contents)
}

fn read_archive(path: &Path) -> Result<(serde_json::Value, String), String> {
    let file = File::open(path)
        .map_err(|error| format!("Failed to open {}: {}", path.display(), error))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", path.display(), error))?;

    let metadata_text = read_entry_text(&mut archive, METADATA_ENTRY, MAX_METADATA_SIZE)?;
    let metadata: serde_json::Value = serde_json::from_str(&metadata_text)
        .map_err(|error| format!("'{}' is not valid JSON: {}", METADATA_ENTRY, error))?;
    let code = read_entry_text(&mut archive, CODE_ENTRY, MAX_CODE_SIZE)?;

    Ok((metadata, code))
}

#[tauri::command]
pub async fn read_extensions(extensions_dir_path: String) -> Result<ExtensionsReadResult, String> {
    let extensions_dir = PathBuf::from(extensions_dir_path);

    tokio::task::spawn_blocking(move || {
        let entries = std::fs::read_dir(&extensions_dir)
            .map_err(|error| format!("Failed to read {}: {}", extensions_dir.display(), error))?;

        let mut archive_paths: Vec<PathBuf> = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|error| {
                format!("Failed to read an entry of {}: {}", extensions_dir.display(), error)
            })?;
            let path = entry.path();

            if path.is_file() && is_extension_archive(&path) {
                archive_paths.push(path);
            }
        }

        // Sort so that extensions always load in the same order
        archive_paths.sort();

        let mut extensions: Vec<ExtensionFile> = Vec::new();
        let mut failures: Vec<ExtensionFailure> = Vec::new();

        // One broken archive should not prevent other extensions from loading,
        // so per-archive errors are collected instead of failing the whole command
        for path in archive_paths {
            let file_name = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();

            match read_archive(&path) {
                Ok((metadata, code)) => {
                    let code_sha256 = sha256_hex(code.as_bytes());

                    extensions.push(ExtensionFile {
                        file_name,
                        metadata,
                        code,
                        code_sha256,
                    })
                }
                Err(error) => failures.push(ExtensionFailure { file_name, error }),
            }
        }

        Ok(ExtensionsReadResult {
            extensions,
            failures,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

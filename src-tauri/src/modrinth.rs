///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::ZipArchive;

const MANIFEST_ENTRY: &str = "modrinth.index.json";
const OVERRIDE_PREFIXES: [&str; 2] = ["overrides", "client-overrides"];
const TRUSTED_PREFIX: &str = "https://cdn.modrinth.com/";

#[derive(Deserialize, Default)]
struct RawHashes {
    #[serde(default)]
    sha1: String,
    #[serde(default)]
    sha512: String,
}

#[derive(Deserialize)]
struct RawFile {
    path: String,
    #[serde(default)]
    hashes: RawHashes,
    #[serde(default)]
    downloads: Vec<String>,
    #[serde(default, rename = "fileSize")]
    file_size: u64,
}

#[derive(Deserialize)]
struct RawIndex {
    #[serde(default, rename = "formatVersion")]
    format_version: u32,
    #[serde(default)]
    name: String,
    #[serde(default, rename = "versionId")]
    version_id: String,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    dependencies: HashMap<String, String>,
    #[serde(default)]
    files: Vec<RawFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    // Relative to the Minecraft directory, e.g., "mods/sodium.jar"
    pub path: String,
    pub url: String,
    pub file_size: u64,
    pub sha1: String,
    pub sha512: String,
    pub external: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MrpackManifest {
    pub format_version: u32,
    pub name: String,
    pub version_id: String,
    pub summary: Option<String>,
    // For example, { "minecraft": "1.20.1", "fabric-loader": "0.15.11" }
    pub dependencies: HashMap<String, String>,
    pub files: Vec<ManifestFile>,
    // How many override entries were written into the target directory
    pub overrides: usize,
}

#[tauri::command]
pub async fn install_mrpack(
    archive_path: String,
    target_dir_path: String,
) -> Result<MrpackManifest, String> {
    tokio::task::spawn_blocking(move || {
        install(Path::new(&archive_path), Path::new(&target_dir_path))
    })
    .await
    .map_err(|join_error| join_error.to_string())?
}

#[tauri::command]
pub async fn peek_mrpack(archive_path: String) -> Result<Option<MrpackManifest>, String> {
    tokio::task::spawn_blocking(move || peek(Path::new(&archive_path)))
        .await
        .map_err(|join_error| join_error.to_string())?
}

fn peek(archive_path: &Path) -> Result<Option<MrpackManifest>, String> {
    let file = File::open(archive_path)
        .map_err(|error| format!("Failed to open {}: {}", archive_path.display(), error))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", archive_path.display(), error))?;

    if archive.by_name(MANIFEST_ENTRY).is_err() {
        return Ok(None);
    }

    let manifest = read_manifest(&mut archive, archive_path)?;

    Ok(Some(build_manifest(manifest, 0)))
}

fn install(archive_path: &Path, target_dir: &Path) -> Result<MrpackManifest, String> {
    let file = File::open(archive_path)
        .map_err(|error| format!("Failed to open {}: {}", archive_path.display(), error))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", archive_path.display(), error))?;

    let manifest = read_manifest(&mut archive, archive_path)?;
    let overrides = extract_overrides(&mut archive, archive_path, target_dir)?;

    Ok(build_manifest(manifest, overrides))
}

fn build_manifest(manifest: RawIndex, overrides: usize) -> MrpackManifest {
    MrpackManifest {
        format_version: manifest.format_version,
        name: manifest.name,
        version_id: manifest.version_id,
        summary: manifest.summary,
        dependencies: manifest.dependencies,
        files: manifest.files.into_iter().filter_map(map_file).collect(),
        overrides,
    }
}

fn map_file(raw: RawFile) -> Option<ManifestFile> {
    let url = raw
        .downloads
        .into_iter()
        .find(|url| url.starts_with("https://"))?;

    Some(ManifestFile {
        external: !url.starts_with(TRUSTED_PREFIX),
        path: raw.path,
        url,
        file_size: raw.file_size,
        sha1: raw.hashes.sha1,
        sha512: raw.hashes.sha512,
    })
}

fn read_manifest(
    archive: &mut ZipArchive<File>,
    archive_path: &Path,
) -> Result<RawIndex, String> {
    let mut entry = archive.by_name(MANIFEST_ENTRY).map_err(|error| {
        format!(
            "Failed to read '{}' in {}: {}",
            MANIFEST_ENTRY,
            archive_path.display(),
            error,
        )
    })?;

    let mut contents = String::with_capacity(entry.size() as usize);

    entry.read_to_string(&mut contents).map_err(|error| {
        format!(
            "Failed to read '{}' in {}: {}",
            MANIFEST_ENTRY,
            archive_path.display(),
            error,
        )
    })?;

    serde_json::from_str(&contents)
        .map_err(|error| format!("Failed to parse '{}': {}", MANIFEST_ENTRY, error))
}

fn extract_overrides(
    archive: &mut ZipArchive<File>,
    archive_path: &Path,
    target_dir: &Path,
) -> Result<usize, String> {
    let mut written = 0;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            format!(
                "Failed to read entry #{} in {}: {}",
                index,
                archive_path.display(),
                error,
            )
        })?;

        let Some(entry_path) = entry.enclosed_name() else {
            continue;
        };

        let Some(relative_path) = OVERRIDE_PREFIXES
            .iter()
            .find_map(|prefix| entry_path.strip_prefix(prefix).ok())
        else {
            continue;
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let output_path: PathBuf = target_dir.join(relative_path);

        if entry.is_dir() {
            create_directory(&output_path)?;

            continue;
        }

        if let Some(parent) = output_path.parent() {
            create_directory(parent)?;
        }

        let mut output_file = File::create(&output_path)
            .map_err(|error| format!("Failed to create {}: {}", output_path.display(), error))?;

        io::copy(&mut entry, &mut output_file)
            .map_err(|error| format!("Failed to write {}: {}", output_path.display(), error))?;

        written += 1;
    }

    Ok(written)
}

fn create_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Failed to create {}: {}", path.display(), error))
}

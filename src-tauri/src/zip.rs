use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tokio::task::JoinSet;
use zip::ZipArchive;

#[derive(Deserialize)]
pub struct ArchiveFile {
    pub path: String,
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum UnzipOutcome {
    Success(bool), // always `true`
    Error(String),
}

// Reads a file inside the archive without extracting the whole archive
#[tauri::command]
pub async fn read_archive_entry(
    archive_path: String,
    entry_path: String,
) -> Result<Option<Vec<u8>>, String> {
    tokio::task::spawn_blocking(move || read_entry(Path::new(&archive_path), &entry_path))
        .await
        .map_err(|join_error| join_error.to_string())?
}

fn read_entry(archive_path: &Path, entry_path: &str) -> Result<Option<Vec<u8>>, String> {
    let file = File::open(archive_path)
        .map_err(|error| format!("Failed to open {}: {}", archive_path.display(), error))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", archive_path.display(), error))?;

    let mut entry = match archive.by_name(entry_path) {
        Ok(entry) => entry,
        Err(zip::result::ZipError::FileNotFound) => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Failed to read the '{}' entry in {}: {}",
                entry_path,
                archive_path.display(),
                error,
            ));
        }
    };

    if entry.is_dir() {
        return Ok(None);
    }

    let mut bytes = Vec::with_capacity(entry.size() as usize);

    entry.read_to_end(&mut bytes).map_err(|error| {
        format!(
            "Failed to read the '{}' entry in {}: {}",
            entry_path,
            archive_path.display(),
            error,
        )
    })?;

    Ok(Some(bytes))
}

#[tauri::command]
pub async fn unzip_files(archive_files: Vec<ArchiveFile>, target_dir_path: String) -> UnzipOutcome {
    let target_dir = PathBuf::from(target_dir_path);

    let mut tasks = JoinSet::new();

    for archive_file in archive_files {
        let target_dir = target_dir.clone();
        tasks.spawn_blocking(move || extract_archive(&archive_file, &target_dir));
    }

    let mut errors = Vec::new();

    while let Some(joined) = tasks.join_next().await {
        match joined {
            Ok(Ok(())) => {}
            Ok(Err(message)) => errors.push(message),
            Err(join_error) => errors.push(join_error.to_string()),
        }
    }

    if errors.is_empty() {
        UnzipOutcome::Success(true)
    } else {
        UnzipOutcome::Error(errors.join("\n"))
    }
}

fn extract_archive(archive_file: &ArchiveFile, target_dir: &Path) -> Result<(), String> {
    let archive_path = Path::new(&archive_file.path);

    let file = File::open(archive_path)
        .map_err(|error| format!("Failed to open {}: {}", archive_path.display(), error))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", archive_path.display(), error))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to read entry #{} in {}: {}", index, archive_path.display(), error))?;

        // `extract.exclude` entries are path prefixes, e.g., "META-INF/"
        if archive_file.exclude.iter().any(|prefix| entry.name().starts_with(prefix.as_str())) {
            continue;
        }

        let Some(relative_path) = entry.enclosed_name() else {
            continue;
        };

        let output_path = target_dir.join(relative_path);

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|error| format!("Failed to create {}: {}", output_path.display(), error))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
        }

        let mut output_file = File::create(&output_path)
            .map_err(|error| format!("Failed to create {}: {}", output_path.display(), error))?;

        io::copy(&mut entry, &mut output_file)
            .map_err(|error| format!("Failed to write {}: {}", output_path.display(), error))?;

        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&output_path, fs::Permissions::from_mode(mode));
        }
    }

    Ok(())
}

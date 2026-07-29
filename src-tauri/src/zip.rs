use std::fs::{self, File};
use std::io;
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

        // `extract.exclude` entries are path prefixes, e.g. "META-INF/"
        if archive_file.exclude.iter().any(|prefix| entry.name().starts_with(prefix.as_str())) {
            continue;
        }

        // None = the entry path would escape target_dir (zip-slip); skip it
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

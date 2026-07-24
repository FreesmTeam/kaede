use std::fs::File;
use std::path::PathBuf;

use zip::ZipArchive;

#[tauri::command]
pub async fn unzip_file(archive_file_path: String, target_dir_path: String) -> Result<String, String> {
    let archive_file = PathBuf::from(archive_file_path);
    let target_dir = PathBuf::from(target_dir_path);

    tokio::task::spawn_blocking(move || {
        let file = File::open(&archive_file)
            .map_err(|error| format!("Failed to open {}: {}", archive_file.display(), error))?;

        let mut archive = ZipArchive::new(file)
            .map_err(|error| format!("Failed to read {} as a zip: {}", archive_file.display(), error))?;

        archive
            .extract(&target_dir)
            .map_err(|error| format!("Error extracting zip: {}", error))?;

        Ok("Successfully extracted the provided archive".to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

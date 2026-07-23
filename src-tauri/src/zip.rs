use std::path::PathBuf;
use zip_extensions::*;

#[tauri::command]
pub async fn unzip_file(archive_file_path: String, target_dir_path: String) -> Result<String, String> {
    let archive_file = PathBuf::from(archive_file_path);
    let target_dir = PathBuf::from(target_dir_path);

    tokio::task::spawn_blocking(move || {
        zip_extract(&archive_file, &target_dir)
            .map(|_| "Successfully extracted the provided archive".to_string())
            .map_err(|error| format!("Error extracting zip: {}", error))
    })
    .await
    .map_err(|error| error.to_string())?
}

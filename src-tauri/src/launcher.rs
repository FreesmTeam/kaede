use std::fs;
use std::fs::File;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI32, Ordering};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use tauri::Manager;

static LAUNCHES_COUNT: AtomicI32 = AtomicI32::new(0);

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ParsedFile {
    // For a well-formed JSON
    Loaded { data: Value },
    // The file is empty or does not exist.
    // It will be rewritten with default contents
    Missing,
    // The file exists and is not empty, but has invalid JSON.
    // It will be backed up and a new file with default contents will be created
    Corrupt { raw: String, error: String },
}

async fn load_json_file(path: PathBuf) -> Result<ParsedFile, String> {
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(ParsedFile::Missing),
        Err(e) => return Err(format!("Failed to read {}: {}", path.display(), e)),
    };

    // Treat empty files as missing (so that they will be rewritten without any corrupt file backups)
    if content.trim().is_empty() {
        return Ok(ParsedFile::Missing);
    }

    match serde_json::from_str::<Value>(&content) {
        Ok(data) => Ok(ParsedFile::Loaded { data }),
        Err(e) => Ok(ParsedFile::Corrupt {
            raw: content,
            error: e.to_string(),
        }),
    }
}

fn extract_locale(config: &ParsedFile) -> String {
    let ParsedFile::Loaded { data } = config else {
        return "en".to_string();
    };

    data.get("locale")
        .and_then(Value::as_str)
        .filter(|locale| {
            !locale.is_empty()
                && locale
                    .chars()
                    // I do not want to see '../accounts'
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .unwrap_or("en")
        .to_string()
}

pub fn is_portable() -> bool {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("portable.txt").exists();
        }
    }
    false
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateBasic {
    pub launcher_version: String,
    pub base_directory: String,
    pub launch_count: i32,
    pub separator: String,
    pub portable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateParsedFiles {
    pub config: ParsedFile,
    pub accounts: ParsedFile,
    pub instances: ParsedFile,
    pub translations: ParsedFile,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialState {
    pub basic: InitialStateBasic,
    pub parsed: InitialStateParsedFiles,
}

#[tauri::command]
pub async fn get_initial_state(app: tauri::AppHandle) -> Result<InitialState, String> {
    let portable = is_portable();
    let launcher_version = app.package_info().version.to_string();
    let launch_count = LAUNCHES_COUNT.fetch_add(1, Ordering::SeqCst);
    let separator = std::path::MAIN_SEPARATOR.to_string();

    let base_directory = if portable {
        std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or_else(|| "Failed to get executable directory".to_string())?
            .to_path_buf()
    } else {
        app.path().app_data_dir().map_err(|e| e.to_string())?
    };

    let (config, accounts, instances) = tokio::join!(
        load_json_file(base_directory.join("config.json")),
        load_json_file(base_directory.join("accounts.json")),
        load_json_file(base_directory.join("instances.json")),
    );

    let config = config?;
    let accounts = accounts?;
    let instances = instances?;

    let locale = extract_locale(&config);
    let translations = load_json_file(
        base_directory.join("translations").join(format!("{}.json", locale)),
    )
    .await?;

    Ok(InitialState {
        basic: InitialStateBasic {
            launcher_version,
            base_directory: base_directory.to_string_lossy().to_string(),
            launch_count,
            separator,
            portable,
        },
        parsed: InitialStateParsedFiles {
            config,
            accounts,
            instances,
            translations,
        },
    })
}

// If the 'latest.log' file exists and is not empty,
// then rename that file to 'kaede-{number}.log',
// where 'number' is one greater than the biggest existing log file number.
//
// Else abort the log file preparation.
pub fn prepare_log_file(logs_dir: &Path, app_name: &str) -> std::io::Result<()> {
    let latest_log_path = logs_dir.join("latest.log");

    if !latest_log_path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(&latest_log_path)?;

    // Empty log files are already prepared for logging
    if metadata.len() == 0 {
        return Ok(());
    }

    // Rotated log files are named '{app_name}-{number}.log'
    let prefix = format!("{}-", app_name);

    // We will keep track of the biggest log file number to make a unique file name
    let mut max_number: usize = 0;

    for entry in fs::read_dir(logs_dir)? {
        let entry = entry?;
        let file_name = entry.file_name();

        // Skip files whose names are not valid UTF-8
        let Some(filename) = file_name.to_str() else {
            continue;
        };

        // Count only '{prefix}{number}.log' files
        let number = filename
            .strip_prefix(&prefix)
            .and_then(|rest| rest.strip_suffix(".log"))
            .and_then(|digits| digits.parse::<usize>().ok());

        if let Some(number) = number {
            max_number = max_number.max(number);
        }
    }

    // Get the absolute path of the renamed log file
    let new_log_path = logs_dir.join(format!(
        "{}-{}.log",
        app_name,
        max_number + 1,
    ));

    // 'latest.log' becomes 'kaede-{number}.log'
    fs::rename(&latest_log_path, &new_log_path)?;

    Ok(())
}

#[tauri::command]
pub async fn get_missing_files(paths: Vec<String>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        paths
            .into_par_iter()
            .filter(|path| !Path::new(path).exists())
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct Artifact {
    path: String,
    hash: String,
}

#[tauri::command]
pub async fn verify_file_paths(artifacts: Vec<Artifact>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mismatched_paths: Vec<String> = artifacts
            .par_iter()
            .filter_map(|artifact| {
                let path = Path::new(&artifact.path);

                if !path.exists() {
                    return Some(artifact.path.clone());
                }

                // Artifacts that did not specify SHA1 hashes have been assigned to 'ignore'
                if artifact.hash == "ignore" {
                    return None;
                }

                match verify_file_hash(path, &artifact.hash) {
                    Ok(is_valid) => {
                        if !is_valid {
                            Some(artifact.path.clone())
                        } else {
                            None
                        }
                    }
                    Err(_) => Some(artifact.path.clone()),
                }
            })
            .collect();

        Ok(mismatched_paths)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn verify_file_hash(path: &Path, expected_hash: &str) -> io::Result<bool> {
    let mut file = File::open(path)?;

    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    let actual_hash = format!("{:x}", hasher.finalize());

    Ok(actual_hash == expected_hash)
}

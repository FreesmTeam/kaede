use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use tauri::Manager;

const INSTALLED_WINDOW_TITLE: &str = "Kaede";
const PORTABLE_WINDOW_TITLE: &str = "Kaede Portable";

#[derive(Debug, Serialize)]
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

#[derive(Clone, Debug)]
pub struct RuntimePaths {
    pub portable: bool,
    pub base_directory: PathBuf,
    pub executable_directory: PathBuf,
    pub app_data_directory: PathBuf,
}

impl RuntimePaths {
    pub fn capability_decisions_path(&self) -> PathBuf {
        self.base_directory.join("capability-decisions.json")
    }
}

pub(crate) fn window_title(runtime_paths: &RuntimePaths) -> &'static str {
    if runtime_paths.portable {
        PORTABLE_WINDOW_TITLE
    } else {
        INSTALLED_WINDOW_TITLE
    }
}

pub fn select_runtime_paths<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<RuntimePaths, String> {
    let executable_directory = executable_directory().map_err(|error| error.to_string())?;
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    select_runtime_paths_from(executable_directory, app_data_directory)
        .map_err(|error| error.to_string())
}

pub(crate) fn select_runtime_paths_from(
    executable_directory: PathBuf,
    app_data_directory: PathBuf,
) -> io::Result<RuntimePaths> {
    let executable_directory = fs::canonicalize(executable_directory)?;
    let portable = executable_directory.join("portable.txt").exists();
    let selected_directory = if portable {
        executable_directory.clone()
    } else {
        app_data_directory.clone()
    };
    fs::create_dir_all(&selected_directory)?;
    let base_directory = fs::canonicalize(selected_directory)?;
    let app_data_directory = if portable {
        app_data_directory
    } else {
        base_directory.clone()
    };

    Ok(RuntimePaths {
        portable,
        base_directory,
        executable_directory,
        app_data_directory,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateBasic {
    pub launcher_version: String,
    pub base_directory: String,
    pub launch_count: i32,
    pub separator: String,
    pub portable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateParsedFiles {
    pub config: ParsedFile,
    pub accounts: ParsedFile,
    pub instances: ParsedFile,
    pub translations: ParsedFile,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialState {
    pub basic: InitialStateBasic,
    pub parsed: InitialStateParsedFiles,
}

pub async fn get_initial_state<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    launch_count: i32,
    runtime_paths: &RuntimePaths,
) -> Result<InitialState, String> {
    let launcher_version = app.package_info().version.to_string();
    let separator = std::path::MAIN_SEPARATOR.to_string();
    let base_directory = &runtime_paths.base_directory;

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
        base_directory
            .join("translations")
            .join(format!("{locale}.json")),
    )
    .await?;

    Ok(InitialState {
        basic: InitialStateBasic {
            launcher_version,
            base_directory: base_directory.to_string_lossy().to_string(),
            launch_count,
            separator,
            portable: runtime_paths.portable,
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
    let prefix = format!("{app_name}-");

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
    let new_log_path = logs_dir.join(format!("{}-{}.log", app_name, max_number + 1,));

    // 'latest.log' becomes 'kaede-{number}.log'
    fs::rename(&latest_log_path, &new_log_path)?;

    Ok(())
}

pub fn executable_directory() -> io::Result<PathBuf> {
    std::env::current_exe()?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| io::Error::other("executable path has no parent directory"))
}

pub fn missing_files(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    paths
        .into_par_iter()
        .filter(|path| !path.exists())
        .collect()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub path: PathBuf,
    pub hash: String,
}

pub fn verify_file_paths(artifacts: Vec<Artifact>) -> Vec<PathBuf> {
    artifacts
        .par_iter()
        .filter_map(|artifact| {
            if !artifact.path.exists() {
                return Some(artifact.path.clone());
            }

            // Artifacts that did not specify SHA1 hashes have been assigned to 'ignore'.
            if artifact.hash == "ignore" {
                return None;
            }

            match verify_file_hash(&artifact.path, &artifact.hash) {
                Ok(true) => None,
                Ok(false) | Err(_) => Some(artifact.path.clone()),
            }
        })
        .collect()
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

    let actual_hash = crate::hashes::lowercase_hex(&hasher.finalize());

    Ok(actual_hash == expected_hash)
}

#[cfg(test)]
mod tests {
    use super::{select_runtime_paths_from, window_title};

    #[test]
    fn portable_marker_controls_runtime_window_title() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock should follow the Unix epoch")
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "kaede-portable-title-{}-{}",
            std::process::id(),
            nonce
        ));
        let executable_directory = fixture_root.join("app");
        let app_data_directory = fixture_root.join("app-data");
        std::fs::create_dir_all(&executable_directory).expect("executable directory should exist");

        let installed =
            select_runtime_paths_from(executable_directory.clone(), app_data_directory.clone())
                .expect("installed runtime paths should resolve");
        assert!(!installed.portable);
        assert_eq!(window_title(&installed), "Kaede");

        std::fs::write(executable_directory.join("portable.txt"), b"")
            .expect("portable marker should exist");
        let portable = select_runtime_paths_from(executable_directory, app_data_directory)
            .expect("portable runtime paths should resolve");
        assert!(portable.portable);
        assert_eq!(window_title(&portable), "Kaede Portable");

        std::fs::remove_dir_all(fixture_root).expect("test fixture should be removable");
    }
}

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherInitReport {
    pub created_directories: Vec<String>,
    pub java_major: Option<u32>,
    // "release-file" (JVM was not spawned)
    // "spawn" (JVM was spawned)
    // "unresolved" (returns None)
    pub java_major_source: &'static str,
}

#[tauri::command]
pub async fn finalize_initialization(
    base_directory: String,
    folders: Vec<String>,
    java_binary: String,
) -> Result<LauncherInitReport, String> {
    let dirs_task = tokio::task::spawn_blocking(move || {
        ensure_directories(Path::new(&base_directory), &folders)
    });
    let java_task = tokio::task::spawn_blocking(move || detect_java_major(&java_binary));

    let (dirs, java) = tokio::join!(dirs_task, java_task);

    let created_directories = dirs
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Failed to create launcher directories: {}", e))?;
    let (java_major, java_major_source) = java.map_err(|e| e.to_string())?;

    Ok(LauncherInitReport {
        created_directories,
        java_major,
        java_major_source,
    })
}

fn ensure_directories(base: &Path, folders: &[String]) -> io::Result<Vec<String>> {
    let mut created = Vec::new();

    for folder in folders {
        let path = base.join(folder);

        if !path.exists() {
            fs::create_dir_all(&path)?;
            created.push(path.to_string_lossy().to_string());
        }
    }

    Ok(created)
}

// JDK/JRE vendors usually ship a 'release' file next to bin/ containing
// JAVA_VERSION="...". It is useful if we do not want to spawn a Java process
// to get the java major from that process output
fn detect_java_major(java_binary: &str) -> (Option<u32>, &'static str) {
    let Some(exe) = resolve_java_path(java_binary) else {
        return (None, "unresolved");
    };

    if let Some(major) = major_from_release_file(&exe) {
        return (Some(major), "release-file");
    }

    if let Some(major) = major_from_spawn(&exe) {
        return (Some(major), "spawn");
    }

    (None, "unresolved")
}

fn resolve_java_path(java_binary: &str) -> Option<PathBuf> {
    let path = Path::new(java_binary);

    if path.is_absolute() {
        return path.is_file().then(|| path.to_path_buf());
    }

    // returns ".exe" on Windows and "" elsewhere
    let suffix = std::env::consts::EXE_SUFFIX;
    let mut exe_name = java_binary.to_string();

    if !suffix.is_empty() && !exe_name.ends_with(suffix) {
        exe_name.push_str(suffix);
    }

    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(&exe_name))
            .find(|candidate| candidate.is_file())
    })
}

// JAVA_VERSION="21.0.1"
fn major_from_release_file(java_exe: &Path) -> Option<u32> {
    let release = java_exe.parent()?.parent()?.join("release");
    let content = fs::read_to_string(release).ok()?;

    let line = content
        .lines()
        .find(|line| line.starts_with("JAVA_VERSION="))?;
    let version = line.split('=').nth(1)?.trim().trim_matches('"');

    parse_java_major(version)
}

fn major_from_spawn(java_exe: &Path) -> Option<u32> {
    let spawn_target = if java_exe.file_stem().and_then(|s| s.to_str()) == Some("javaw") {
        let sibling = java_exe.with_file_name(format!("java{}", std::env::consts::EXE_SUFFIX));
        if sibling.is_file() {
            sibling
        } else {
            java_exe.to_path_buf()
        }
    } else {
        java_exe.to_path_buf()
    };

    let mut command = Command::new(spawn_target);
    // '-version' instead of '--version' since '--version' fails in Java 8 and older
    command.arg("-version");

    // Prevent a console window from flashing on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let output = command.output().ok()?;

    // Goes to stderr but we should probably check for stdout as well
    let stderr = String::from_utf8_lossy(&output.stderr);
    let banner = if stderr.trim().is_empty() {
        String::from_utf8_lossy(&output.stdout)
    } else {
        stderr
    };

    major_from_banner(&banner)
}

// banner is:
//   openjdk version "25.0.1" 2025-10-21 LTS
//   java version "1.8.0_472"
fn major_from_banner(banner: &str) -> Option<u32> {
    let version_line = banner.lines().find(|line| line.contains("version"))?;
    let quoted = version_line.split('"').nth(1)?;

    parse_java_major(quoted)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaMajorReport {
    pub major: Option<u32>,
    pub source: &'static str,
}

#[tauri::command]
pub async fn get_java_major(java_binary: String) -> Result<JavaMajorReport, String> {
    tokio::task::spawn_blocking(move || detect_java_major(&java_binary))
        .await
        .map(|(major, source)| JavaMajorReport { major, source })
        .map_err(|e| e.to_string())
}

// "25.0.2" -> 25
// "21" -> 21
// "21.0.1+12" -> 21
// "1.8.0_472" -> 8
fn parse_java_major(version: &str) -> Option<u32> {
    let mut parts = version.split(['.', '_', '-', '+']);
    let first: u32 = parts.next()?.trim().parse().ok()?;

    if first == 1 {
        parts.next()?.trim().parse().ok()
    } else {
        Some(first)
    }
}


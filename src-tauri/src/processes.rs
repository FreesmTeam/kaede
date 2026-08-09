use std::{collections::HashMap, path::PathBuf, sync::Mutex, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shellx::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const TICK: Duration = Duration::from_millis(100);

#[derive(Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum Program {
    // Command#create equivalent
    Path(String),
    // Command#sidecar equivalent
    Sidecar(String),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnSpec {
    token: String,
    program: Program,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<PathBuf>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
    kind: String,
    #[serde(default)]
    meta: Value,
}

struct ProcessEntry {
    token: String,
    kind: String,
    meta: Value,
    child: CommandChild,
}

#[derive(Default)]
pub struct ProcessRegistry(Mutex<HashMap<u32, ProcessEntry>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDto {
    token: String,
    pid: u32,
    kind: String,
    meta: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OutputPayload {
    token: String,
    pid: u32,
    stream: &'static str,
    lines: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    token: String,
    pid: u32,
    message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ExitPayload {
    token: String,
    pid: u32,
    kind: String,
    code: Option<i32>,
    signal: Option<i32>,
}

fn into_line(bytes: &[u8]) -> String {
    let mut line = String::from_utf8_lossy(bytes).into_owned();
    line.truncate(line.trim_end_matches(|c| c == '\r' || c == '\n').len());
    line
}

fn flush_output(
    app: &AppHandle,
    token: &str,
    pid: u32,
    stdout: &mut Vec<String>,
    stderr: &mut Vec<String>,
) {
    for (stream, pending) in [("stdout", stdout), ("stderr", stderr)] {
        if pending.is_empty() {
            continue;
        }

        let _ = app.emit("process-output", OutputPayload {
            token: token.to_owned(),
            pid,
            stream,
            lines: std::mem::take(pending),
        });
    }
}

#[tauri::command]
pub async fn spawn_process(
    app: AppHandle,
    registry: State<'_, ProcessRegistry>,
    spec: SpawnSpec,
) -> Result<ProcessDto, String> {
    let mut command = match &spec.program {
        Program::Path(program) => app.shell().command(program),
        Program::Sidecar(name) => app.shell().sidecar(name).map_err(|e| e.to_string())?,
    };

    command = command.args(&spec.args);
    if let Some(cwd) = &spec.cwd {
        command = command.current_dir(cwd);
    }
    if let Some(env) = &spec.env {
        command = command.envs(env.clone());
    }

    let (mut rx, child) = command.spawn().map_err(|e| e.to_string())?;
    let pid = child.pid();

    let dto = ProcessDto { token: spec.token.clone(), pid, kind: spec.kind.clone(), meta: spec.meta.clone() };

    registry.0.lock().unwrap().insert(pid, ProcessEntry {
        token: spec.token.clone(),
        kind: spec.kind,
        meta: spec.meta,
        child,
    });

    let (token, kind, app) = (spec.token, dto.kind.clone(), app.clone());
    tauri::async_runtime::spawn(async move {
        let mut stdout_pending: Vec<String> = Vec::new();
        let mut stderr_pending: Vec<String> = Vec::new();

        let mut interval = tokio::time::interval(TICK);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                event = rx.recv() => match event {
                    Some(CommandEvent::Stdout(bytes)) => stdout_pending.push(into_line(&bytes)),
                    Some(CommandEvent::Stderr(bytes)) => stderr_pending.push(into_line(&bytes)),
                    Some(CommandEvent::Error(message)) => {
                        // Anything printed before the failure arrives before it
                        flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
                        let _ = app.emit("process-error", ErrorPayload { token: token.clone(), pid, message });
                    }
                    Some(CommandEvent::Terminated(payload)) => {
                        // shellx sends 'Terminated' only after both pipes hit EOF,
                        // so this flush drains every remaining line before the exit event
                        flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
                        app.state::<ProcessRegistry>().0.lock().unwrap().remove(&pid);
                        let _ = app.emit("process-exited", ExitPayload {
                            token: token.clone(), pid, kind: kind.clone(),
                            code: payload.code, signal: payload.signal,
                        });
                    }
                    Some(_) => {} // #[non_exhaustive]
                    None => {
                        flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
                        break;
                    }
                },
                _ = interval.tick(), if !stdout_pending.is_empty() || !stderr_pending.is_empty() => {
                    flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
                }
            }
        }
    });

    Ok(dto)
}

#[tauri::command]
pub fn list_processes(registry: State<'_, ProcessRegistry>) -> Vec<ProcessDto> {
    registry.0.lock().unwrap().iter()
        .map(|(pid, e)| ProcessDto {
            token: e.token.clone(), pid: *pid, kind: e.kind.clone(), meta: e.meta.clone(),
        })
        .collect()
}

#[tauri::command]
pub fn kill_process(registry: State<'_, ProcessRegistry>, pid: u32) -> Result<(), String> {
    let entry = registry.0.lock().unwrap().remove(&pid)
        .ok_or_else(|| format!("no managed process with pid {pid}"))?;
    entry.child.kill().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum StdinData { Text(String), Bytes(Vec<u8>) }

#[tauri::command]
pub fn write_process(registry: State<'_, ProcessRegistry>, pid: u32, data: StdinData) -> Result<(), String> {
    let mut map = registry.0.lock().unwrap();
    let entry = map.get_mut(&pid).ok_or_else(|| format!("no managed process with pid {pid}"))?;
    match &data {
        StdinData::Text(s) => entry.child.write(s.as_bytes()),
        StdinData::Bytes(b) => entry.child.write(b),
    }.map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSpec {
    program: Program,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<PathBuf>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    code: Option<i32>,
    success: bool,
    stdout: String,
    stderr: String,
}

#[tauri::command]
pub async fn run_process(app: AppHandle, spec: RunSpec) -> Result<RunResult, String> {
    let mut command = match &spec.program {
        Program::Path(program) => app.shell().command(program),
        Program::Sidecar(name) => app.shell().sidecar(name).map_err(|e| e.to_string())?,
    };

    command = command.args(&spec.args);
    if let Some(cwd) = &spec.cwd {
        command = command.current_dir(cwd);
    }
    if let Some(env) = &spec.env {
        command = command.envs(env.clone());
    }

    let output = command.output().await.map_err(|e| e.to_string())?;

    Ok(RunResult {
        code: output.status.code(),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

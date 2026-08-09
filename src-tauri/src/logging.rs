use std::{
    io::SeekFrom,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use serde::Serialize;
use tauri::{ipc::Channel, State};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

const TICK: Duration = Duration::from_millis(100);

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum LogStreamEvent {
    Snapshot(Vec<String>),
    Lines(Vec<String>),
    Truncated,
}

pub struct LogTail {
    path: PathBuf,
    current: Mutex<Option<Arc<AtomicBool>>>,
}

impl LogTail {
    pub fn new(path: PathBuf) -> Self {
        Self { path, current: Mutex::new(None) }
    }

    // Starting a new stream stops the previous one
    fn begin(&self) -> Arc<AtomicBool> {
        let mut slot = self.current.lock().unwrap();

        if let Some(previous) = slot.take() {
            previous.store(true, Ordering::Relaxed);
        }

        let flag = Arc::new(AtomicBool::new(false));
        *slot = Some(Arc::clone(&flag));

        flag
    }

    fn stop(&self) -> bool {
        match self.current.lock().unwrap().take() {
            Some(flag) => {
                flag.store(true, Ordering::Relaxed);
                true
            }
            None => false,
        }
    }
}

#[tauri::command]
pub fn stop_log_stream(state: State<'_, LogTail>) -> bool {
    state.stop()
}

#[tauri::command]
pub async fn stream_logs(
    state: State<'_, LogTail>,
    on_event: Channel<LogStreamEvent>,
) -> Result<(), String> {
    let stopped = state.begin();
    let path = state.path.clone();

    // Everything up to the last complete line
    let contents = match tokio::fs::read(&path).await {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(error) => return Err(error.to_string()),
    };

    let mut offset = contents
        .iter()
        .rposition(|&byte| byte == b'\n')
        .map(|position| (position + 1) as u64)
        .unwrap_or(0);

    let snapshot = String::from_utf8_lossy(&contents[..offset as usize])
        .lines()
        .map(str::to_owned)
        .collect();

    let _ = on_event.send(LogStreamEvent::Snapshot(snapshot));

    let mut interval = tokio::time::interval(TICK);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;

        if stopped.load(Ordering::Relaxed) {
            break;
        }

        let length = match tokio::fs::metadata(&path).await {
            Ok(metadata) => metadata.len(),
            Err(_) => 0,
        };

        if length < offset {
            offset = 0;
            let _ = on_event.send(LogStreamEvent::Truncated);

            continue;
        }

        if length == offset {
            continue;
        }

        let Ok(mut file) = tokio::fs::File::open(&path).await else {
            continue;
        };

        if file.seek(SeekFrom::Start(offset)).await.is_err() {
            continue;
        }

        let mut buffer = Vec::with_capacity((length - offset) as usize);

        if file.read_to_end(&mut buffer).await.is_err() {
            continue;
        }

        let Some(line_end) = buffer.iter().rposition(|&byte| byte == b'\n') else {
            continue;
        };

        let lines = String::from_utf8_lossy(&buffer[..=line_end])
            .lines()
            .map(str::to_owned)
            .collect();

        offset += (line_end + 1) as u64;

        let _ = on_event.send(LogStreamEvent::Lines(lines));
    }

    Ok(())
}

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, State};
use tokio::io::AsyncWriteExt;

#[derive(Deserialize)]
pub struct DownloadEntry {
    pub url: String,
    pub path: String,
}

struct FileProgress {
    downloaded: u64,
    total: u64,
    last_downloaded: u64,
}

#[derive(Serialize, Clone)]
pub struct DownloadSnapshot {
    // path -> [percent, bytes_per_second]
    current: HashMap<String, (u8, u64)>,
    success: usize,
    failed: usize,
}

#[derive(Serialize)]
pub struct FailedDownload {
    url: String,
    path: String,
    error: String,
}

#[derive(Serialize)]
pub struct DownloadReport {
    success: usize,
    failed: usize,
    cancelled: bool,
    failures: Vec<FailedDownload>,
}

enum DownloadError {
    Cancelled,
    Other(String),
}

impl DownloadError {
    fn other(error: impl ToString) -> Self {
        DownloadError::Other(error.to_string())
    }
}

#[derive(Default)]
pub struct CancelFlags(Mutex<HashMap<String, CancelEntry>>);

struct CancelEntry {
    flag: Arc<AtomicBool>,
    batches: usize,
}

impl CancelFlags {
    fn register(&self, id: &str) -> Arc<AtomicBool> {
        let mut map = self.0.lock().unwrap();
        let entry = map.entry(id.to_string()).or_insert_with(|| CancelEntry {
            flag: Arc::default(),
            batches: 0,
        });

        entry.batches += 1;

        Arc::clone(&entry.flag)
    }

    fn deregister(&self, id: &str) {
        let mut map = self.0.lock().unwrap();

        if let Some(entry) = map.get_mut(id) {
            entry.batches -= 1;

            if entry.batches == 0 {
                map.remove(id);
            }
        }
    }
}

type Progress = Arc<Mutex<HashMap<String, FileProgress>>>;

#[tauri::command]
pub fn cancel_downloads(state: State<CancelFlags>, cancel_id: String) -> bool {
    match state.0.lock().unwrap().get(&cancel_id) {
        Some(entry) => {
            entry.flag.store(true, Ordering::Relaxed);
            true
        }
        None => false,
    }
}

#[tauri::command]
pub async fn concurrently_download(
    state: State<'_, CancelFlags>,
    entries: Vec<DownloadEntry>,
    concurrency: usize,
    label: String,
    cancel_id: String,
    on_progress: Channel<DownloadSnapshot>,
    debug: bool,
) -> Result<DownloadReport, String> {
    let concurrency = concurrency.max(1);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let cancel = state.register(&cancel_id);

    let entries = Arc::new(entries);
    let next_index = Arc::new(AtomicUsize::new(0));
    let progress: Progress = Arc::default();
    let success = Arc::new(AtomicUsize::new(0));
    let failed = Arc::new(AtomicUsize::new(0));

    // One snapshot per tick for the whole batch
    let ticker = tauri::async_runtime::spawn({
        let progress = Arc::clone(&progress);
        let success = Arc::clone(&success);
        let failed = Arc::clone(&failed);
        let channel = on_progress.clone();

        async move {
            let mut interval = tokio::time::interval(Duration::from_millis(100));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                interval.tick().await;

                let current = {
                    let mut files = progress.lock().unwrap();

                    files
                        .iter_mut()
                        .map(|(path, file)| {
                            // Ticks are 100ms apart, so delta * 10 is roughly bytes/sec
                            let speed = (file.downloaded - file.last_downloaded) * 10;
                            file.last_downloaded = file.downloaded;

                            let percent = match file.total {
                                0 => 0,
                                total => (file.downloaded * 100 / total).min(100) as u8,
                            };

                            (path.clone(), (percent, speed))
                        })
                        .collect::<HashMap<_, _>>()
                };

                let _ = channel.send(DownloadSnapshot {
                    current,
                    success: success.load(Ordering::Relaxed),
                    failed: failed.load(Ordering::Relaxed),
                });
            }
        }
    });

    let mut workers = Vec::with_capacity(concurrency);

    for _ in 0..concurrency {
        let client = client.clone();
        let label = label.clone();
        let entries = Arc::clone(&entries);
        let next_index = Arc::clone(&next_index);
        let progress = Arc::clone(&progress);
        let success = Arc::clone(&success);
        let failed = Arc::clone(&failed);
        let cancel = Arc::clone(&cancel);

        workers.push(tauri::async_runtime::spawn(async move {
            let mut failures: Vec<FailedDownload> = Vec::new();

            loop {
                if cancel.load(Ordering::Relaxed) {
                    break;
                }

                let index = next_index.fetch_add(1, Ordering::Relaxed);

                let Some(entry) = entries.get(index) else {
                    break;
                };

                let result = download_one(&client, entry, &progress, &cancel).await;

                progress.lock().unwrap().remove(&entry.path);

                match result {
                    Ok(()) => {
                        success.fetch_add(1, Ordering::Relaxed);
                        if debug {
                            log::debug!("{label}: downloaded '{}'", entry.url);
                        }
                    }
                    Err(DownloadError::Cancelled) => {
                        if debug {
                            log::debug!("{label}: cancelled '{}'", entry.url);
                        }
                        break;
                    }
                    Err(DownloadError::Other(error)) => {
                        failed.fetch_add(1, Ordering::Relaxed);
                        log::error!("{label}: could not download '{}': {error}", entry.url);
                        failures.push(FailedDownload {
                            url: entry.url.clone(),
                            path: entry.path.clone(),
                            error,
                        });
                    }
                }
            }

            failures
        }));
    }

    let mut failures: Vec<FailedDownload> = Vec::new();

    for worker in workers {
        if let Ok(worker_failures) = worker.await {
            failures.extend(worker_failures);
        }
    }

    ticker.abort();
    state.deregister(&cancel_id);

    let report = DownloadReport {
        success: success.load(Ordering::Relaxed),
        failed: failed.load(Ordering::Relaxed),
        cancelled: cancel.load(Ordering::Relaxed),
        failures,
    };

    // Final snapshot
    let _ = on_progress.send(DownloadSnapshot {
        current: HashMap::new(),
        success: report.success,
        failed: report.failed,
    });

    Ok(report)
}

async fn download_one(
    client: &reqwest::Client,
    entry: &DownloadEntry,
    progress: &Progress,
    cancel: &AtomicBool,
) -> Result<(), DownloadError> {
    let mut response = client
        .get(&entry.url)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(DownloadError::other)?;

    let total = response.content_length().unwrap_or(0);

    progress.lock().unwrap().insert(
        entry.path.clone(),
        FileProgress { downloaded: 0, total, last_downloaded: 0 },
    );

    let path = PathBuf::from(&entry.path);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(DownloadError::other)?;
    }

    let partial = PathBuf::from(format!("{}.part", entry.path));
    let file = tokio::fs::File::create(&partial)
        .await
        .map_err(DownloadError::other)?;
    let mut writer = tokio::io::BufWriter::new(file);

    let streamed: Result<(), DownloadError> = async {
        while let Some(chunk) = response.chunk().await.map_err(DownloadError::other)? {
            if cancel.load(Ordering::Relaxed) {
                return Err(DownloadError::Cancelled);
            }

            writer
                .write_all(&chunk)
                .await
                .map_err(DownloadError::other)?;

            if let Some(file) = progress.lock().unwrap().get_mut(&entry.path) {
                file.downloaded += chunk.len() as u64;
            }
        }

        writer.flush().await.map_err(DownloadError::other)
    }
    .await;

    if let Err(error) = streamed {
        // Close the handle since Windows will not delete an open file
        let _ = writer.shutdown().await;
        drop(writer);
        let _ = tokio::fs::remove_file(&partial).await;

        return Err(error);
    }

    tokio::fs::rename(&partial, &path)
        .await
        .map_err(DownloadError::other)
}

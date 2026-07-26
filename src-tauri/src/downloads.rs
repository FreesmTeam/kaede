use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
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
    /// path -> [percent, bytes_per_second]
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
    failures: Vec<FailedDownload>,
}

type Progress = Arc<Mutex<HashMap<String, FileProgress>>>;

#[tauri::command]
pub async fn concurrently_download(
    entries: Vec<DownloadEntry>,
    concurrency: usize,
    label: String,
    on_progress: Channel<DownloadSnapshot>,
) -> Result<DownloadReport, String> {
    let concurrency = concurrency.max(1);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;

    let entries = Arc::new(entries);
    let next_index = Arc::new(AtomicUsize::new(0));
    let progress: Progress = Arc::default();
    let success = Arc::new(AtomicUsize::new(0));
    let failed = Arc::new(AtomicUsize::new(0));

    // One snapshot per tick for the whole batch, regardless of file count.
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
                            // Ticks are 100ms apart, so delta * 10 ≈ bytes/sec.
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

        workers.push(tauri::async_runtime::spawn(async move {
            let mut failures: Vec<FailedDownload> = Vec::new();

            // `indexReference.value++`, except actually atomic.
            loop {
                let index = next_index.fetch_add(1, Ordering::Relaxed);

                let Some(entry) = entries.get(index) else {
                    break;
                };

                let result = download_one(&client, entry, &progress).await;

                progress.lock().unwrap().remove(&entry.path);

                match result {
                    Ok(()) => {
                        success.fetch_add(1, Ordering::Relaxed);
                        log::debug!("{label}: downloaded '{}'", entry.url);
                    }
                    Err(error) => {
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

    // Promise.all
    let mut failures: Vec<FailedDownload> = Vec::new();

    for worker in workers {
        if let Ok(worker_failures) = worker.await {
            failures.extend(worker_failures);
        }
    }

    ticker.abort();

    let report = DownloadReport {
        success: success.load(Ordering::Relaxed),
        failed: failed.load(Ordering::Relaxed),
        failures,
    };

    // Final snapshot: empties the in-flight map, settles the counters.
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
) -> Result<(), String> {
    let mut response = client
        .get(&entry.url)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?;

    let total = response.content_length().unwrap_or(0);

    progress.lock().unwrap().insert(
        entry.path.clone(),
        FileProgress { downloaded: 0, total, last_downloaded: 0 },
    );

    let path = PathBuf::from(&entry.path);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }

    // Write to `<path>.part`, rename on success — a crash mid-download can
    // never leave a torn client.jar that your missing-check counts as present.
    let partial = PathBuf::from(format!("{}.part", entry.path));
    let file = tokio::fs::File::create(&partial)
        .await
        .map_err(|error| error.to_string())?;
    let mut writer = tokio::io::BufWriter::new(file);

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        writer
            .write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;

        if let Some(file) = progress.lock().unwrap().get_mut(&entry.path) {
            file.downloaded += chunk.len() as u64;
        }
    }

    writer.flush().await.map_err(|error| error.to_string())?;

    tokio::fs::rename(&partial, &path)
        .await
        .map_err(|error| error.to_string())
}

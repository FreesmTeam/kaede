use std::{
    io::SeekFrom,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use tauri::ipc::Channel;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use crate::plugin_broker::BrokerEvent;

const TICK: Duration = Duration::from_millis(100);

pub(crate) struct LogTail {
    path: PathBuf,
    current: Mutex<Option<Arc<AtomicBool>>>,
}

impl LogTail {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            path,
            current: Mutex::new(None),
        }
    }

    /// There is one host log viewer. Starting a new stream revokes an orphaned prior stream.
    fn begin(&self) -> Arc<AtomicBool> {
        let mut slot = self
            .current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);

        if let Some(previous) = slot.take() {
            previous.store(true, Ordering::Release);
        }

        let flag = Arc::new(AtomicBool::new(false));
        *slot = Some(Arc::clone(&flag));

        flag
    }

    pub(crate) fn stop(&self) -> bool {
        let current = self
            .current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take();
        if let Some(flag) = current {
            flag.store(true, Ordering::Release);
            true
        } else {
            false
        }
    }

    pub(crate) async fn stream(&self, on_event: Channel<BrokerEvent>) -> Result<(), String> {
        let stopped = self.begin();
        let contents = match tokio::fs::read(&self.path).await {
            Ok(contents) => contents,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.to_string()),
        };
        let (mut offset, snapshot) = complete_lines(&contents);

        let _ = on_event.send(BrokerEvent::LogSnapshot { lines: snapshot });

        let mut interval = tokio::time::interval(TICK);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;

            if stopped.load(Ordering::Acquire) {
                break;
            }

            let length = match tokio::fs::metadata(&self.path).await {
                Ok(metadata) => metadata.len(),
                Err(_) => 0,
            };

            if length < offset {
                offset = 0;
                let _ = on_event.send(BrokerEvent::LogTruncated);
                continue;
            }

            if length == offset {
                continue;
            }

            let Ok(mut file) = tokio::fs::File::open(&self.path).await else {
                continue;
            };
            if file.seek(SeekFrom::Start(offset)).await.is_err() {
                continue;
            }

            let mut buffer = Vec::with_capacity((length - offset) as usize);
            if file.read_to_end(&mut buffer).await.is_err() {
                continue;
            }

            let (consumed, lines) = complete_lines(&buffer);
            if consumed == 0 {
                continue;
            }

            offset += consumed;
            let _ = on_event.send(BrokerEvent::LogLines { lines });
        }

        Ok(())
    }
}

fn complete_lines(contents: &[u8]) -> (u64, Vec<String>) {
    let Some(line_end) = contents.iter().rposition(|byte| *byte == b'\n') else {
        return (0, Vec::new());
    };
    let consumed = line_end + 1;
    let lines = String::from_utf8_lossy(&contents[..consumed])
        .lines()
        .map(str::to_owned)
        .collect();

    (consumed as u64, lines)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn complete_lines_retains_an_unterminated_tail_for_the_next_read() {
        let (consumed, lines) = complete_lines(b"first\nsecond\npartial");

        assert_eq!(consumed, 13);
        assert_eq!(lines, ["first", "second"]);
    }

    #[test]
    fn replacing_and_stopping_a_stream_revokes_the_correct_flags() {
        let tail = LogTail::new(PathBuf::from("latest.log"));
        let first = tail.begin();
        let second = tail.begin();

        assert!(first.load(Ordering::Acquire));
        assert!(!second.load(Ordering::Acquire));
        assert!(tail.stop());
        assert!(second.load(Ordering::Acquire));
        assert!(!tail.stop());
    }
}

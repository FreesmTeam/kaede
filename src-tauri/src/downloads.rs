use crate::plugin_broker::authorizer::SessionToken;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::Notify;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DownloadEntry {
    pub(crate) url: String,
    pub(crate) path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FailedDownload {
    pub(crate) url: String,
    pub(crate) path: PathBuf,
    pub(crate) error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadReport {
    pub(crate) success: usize,
    pub(crate) failed: usize,
    pub(crate) cancelled: bool,
    pub(crate) failures: Vec<FailedDownload>,
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct CancellationKey {
    session: SessionToken,
    generation: u64,
    cancel_id: String,
}

#[derive(Default)]
struct RegistryState {
    cancellations: BTreeMap<CancellationKey, CancellationEntry>,
    destinations: BTreeSet<DestinationKey>,
    revoked_generations: BTreeSet<u64>,
}

#[derive(Clone, Eq, Ord, PartialEq, PartialOrd)]
enum DestinationKey {
    Exact(PathBuf),
    #[cfg(any(windows, target_os = "macos"))]
    Folded(String),
}

#[cfg(not(any(windows, target_os = "macos")))]
fn destination_key(destination: &Path) -> DestinationKey {
    DestinationKey::Exact(destination.to_path_buf())
}

#[cfg(any(windows, target_os = "macos"))]
fn destination_key(destination: &Path) -> DestinationKey {
    if destination_directory_is_case_sensitive(destination).unwrap_or(false) {
        return DestinationKey::Exact(destination.to_path_buf());
    }
    // Host paths have already been made absolute with their existing ancestor canonicalized.
    // Fold the missing suffix when the actual destination directory is case-insensitive. If its
    // mode cannot be queried, the same fold is a conservative false rejection rather than a race.
    DestinationKey::Folded(destination.as_os_str().to_string_lossy().to_lowercase())
}

#[cfg(any(windows, target_os = "macos"))]
fn nearest_existing_destination_directory(destination: &Path) -> Option<&Path> {
    let mut candidate = destination.parent()?;
    loop {
        match std::fs::metadata(candidate) {
            Ok(metadata) if metadata.is_dir() => return Some(candidate),
            Ok(_) => return None,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                candidate = candidate.parent()?;
            }
            Err(_) => return None,
        }
    }
}

#[cfg(target_os = "macos")]
fn destination_directory_is_case_sensitive(destination: &Path) -> Option<bool> {
    use std::ffi::CString;
    use std::os::raw::{c_char, c_int, c_long};
    use std::os::unix::ffi::OsStrExt;

    unsafe extern "C" {
        fn pathconf(path: *const c_char, name: c_int) -> c_long;
    }

    const PC_CASE_SENSITIVE: c_int = 11;
    let directory = nearest_existing_destination_directory(destination)?;
    let directory = CString::new(directory.as_os_str().as_bytes()).ok()?;
    // SAFETY: `directory` is a NUL-terminated path valid for the duration of this call, and the
    // selector is macOS `_PC_CASE_SENSITIVE`.
    match unsafe { pathconf(directory.as_ptr(), PC_CASE_SENSITIVE) } {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}

#[cfg(windows)]
fn destination_directory_is_case_sensitive(destination: &Path) -> Option<bool> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FileCaseSensitiveInfo, GetFileInformationByHandleEx, FILE_CASE_SENSITIVE_INFO,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        OPEN_EXISTING,
    };

    const FILE_CS_FLAG_CASE_SENSITIVE_DIR: u32 = 1;
    let directory = nearest_existing_destination_directory(destination)?;
    let wide = directory
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    // SAFETY: `wide` is a stable, NUL-terminated UTF-16 path. The handle is closed below on every
    // successful open, and `information` has exactly the layout required by this info class.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            0,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return None;
    }
    let mut information = FILE_CASE_SENSITIVE_INFO::default();
    // SAFETY: `handle` names an open directory and the output buffer matches the declared size.
    let succeeded = unsafe {
        GetFileInformationByHandleEx(
            handle,
            FileCaseSensitiveInfo,
            std::ptr::from_mut(&mut information).cast(),
            std::mem::size_of::<FILE_CASE_SENSITIVE_INFO>() as u32,
        )
    };
    // SAFETY: the handle was returned by `CreateFileW` and is closed exactly once.
    let _ = unsafe { CloseHandle(handle) };
    (succeeded != 0).then_some(information.Flags & FILE_CS_FLAG_CASE_SENSITIVE_DIR != 0)
}

struct CancellationEntry {
    token: Arc<DownloadCancellation>,
    batches: usize,
}

#[derive(Default)]
pub(crate) struct DownloadRegistry {
    state: Mutex<RegistryState>,
    partial_sequence: AtomicU64,
}

impl DownloadRegistry {
    pub(crate) fn register_batch(
        self: &Arc<Self>,
        session: &SessionToken,
        generation: u64,
        cancel_id: &str,
    ) -> BatchRegistration {
        let key = CancellationKey {
            session: session.clone(),
            generation,
            cancel_id: cancel_id.to_owned(),
        };
        let (token, revoked) = {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let revoked = state.revoked_generations.contains(&generation);
            let entry =
                state
                    .cancellations
                    .entry(key.clone())
                    .or_insert_with(|| CancellationEntry {
                        token: Arc::new(DownloadCancellation::default()),
                        batches: 0,
                    });
            entry.batches += 1;
            (Arc::clone(&entry.token), revoked)
        };
        if revoked {
            token.cancel();
        }
        BatchRegistration {
            registry: Arc::clone(self),
            key,
            token,
        }
    }

    pub(crate) fn cancel(&self, session: &SessionToken, generation: u64, cancel_id: &str) -> bool {
        let token = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .cancellations
            .get(&CancellationKey {
                session: session.clone(),
                generation,
                cancel_id: cancel_id.to_owned(),
            })
            .map(|entry| Arc::clone(&entry.token));
        if let Some(token) = token {
            token.cancel();
            true
        } else {
            false
        }
    }

    pub(crate) fn cancel_all(&self) {
        let tokens = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .cancellations
            .values()
            .map(|entry| Arc::clone(&entry.token))
            .collect::<Vec<_>>();
        for token in tokens {
            token.cancel();
        }
    }

    pub(crate) fn cancel_generation(&self, generation: u64) {
        let tokens = {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            state.revoked_generations.insert(generation);
            state
                .cancellations
                .iter()
                .filter(|(key, _entry)| key.generation == generation)
                .map(|(_key, entry)| Arc::clone(&entry.token))
                .collect::<Vec<_>>()
        };
        for token in tokens {
            token.cancel();
        }
    }

    pub(crate) fn try_lease_destination(
        self: &Arc<Self>,
        destination: PathBuf,
    ) -> Result<DestinationLease, String> {
        let key = destination_key(&destination);
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if !state.destinations.insert(key.clone()) {
            return Err(format!(
                "download destination is already owned by an active batch: {}",
                destination.display()
            ));
        }
        Ok(DestinationLease {
            registry: Arc::clone(self),
            key,
        })
    }

    pub(crate) fn next_partial_path(&self, destination: &Path) -> io::Result<PathBuf> {
        let file_name = destination.file_name().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "download destination has no file name",
            )
        })?;
        let sequence = self.partial_sequence.fetch_add(1, Ordering::Relaxed);
        let mut partial_name = OsString::from(".");
        partial_name.push(file_name);
        partial_name.push(format!(
            ".kaede-download-{}-{sequence}.part",
            std::process::id()
        ));
        Ok(destination.with_file_name(partial_name))
    }

    fn deregister(&self, key: &CancellationKey, token: &Arc<DownloadCancellation>) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let remove = state.cancellations.get_mut(key).is_some_and(|entry| {
            if !Arc::ptr_eq(&entry.token, token) {
                return false;
            }
            entry.batches -= 1;
            entry.batches == 0
        });
        if remove {
            state.cancellations.remove(key);
        }
    }

    fn release_destination(&self, key: &DestinationKey) {
        self.state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .destinations
            .remove(key);
    }
}

#[derive(Default)]
pub(crate) struct DownloadCancellation {
    cancelled: AtomicBool,
    notify: Notify,
    commit_gate: Mutex<()>,
}

impl DownloadCancellation {
    fn cancel(&self) {
        let _commit_gate = self
            .commit_gate
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        self.cancelled.store(true, Ordering::Release);
        self.notify.notify_waiters();
    }

    pub(crate) fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }

    pub(crate) async fn cancelled(&self) {
        let notified = self.notify.notified();
        tokio::pin!(notified);
        // `notify_waiters` has no stored permit. Register this waiter before checking the atomic
        // state so a cancellation from another runtime thread cannot land between the check and
        // the first poll of `Notified`.
        notified.as_mut().enable();
        if self.is_cancelled() {
            return;
        }
        notified.await;
    }

    pub(crate) fn commit_if_active<T>(&self, commit: impl FnOnce() -> T) -> Result<T, ()> {
        let _commit_gate = self
            .commit_gate
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if self.is_cancelled() {
            return Err(());
        }
        Ok(commit())
    }
}

pub(crate) struct BatchRegistration {
    registry: Arc<DownloadRegistry>,
    key: CancellationKey,
    token: Arc<DownloadCancellation>,
}

impl BatchRegistration {
    pub(crate) fn cancellation(&self) -> Arc<DownloadCancellation> {
        Arc::clone(&self.token)
    }
}

impl Drop for BatchRegistration {
    fn drop(&mut self) {
        self.registry.deregister(&self.key, &self.token);
    }
}

pub(crate) struct DestinationLease {
    registry: Arc<DownloadRegistry>,
    key: DestinationKey,
}

impl Drop for DestinationLease {
    fn drop(&mut self) {
        self.registry.release_destination(&self.key);
    }
}

pub(crate) struct PartialDownload {
    path: PathBuf,
    committed: bool,
}

impl PartialDownload {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            path,
            committed: false,
        }
    }

    pub(crate) fn commit(mut self, destination: &Path) -> io::Result<()> {
        crate::plugin_broker::replace_file(&self.path, destination)?;
        self.committed = true;
        Ok(())
    }
}

impl Drop for PartialDownload {
    fn drop(&mut self) {
        if !self.committed {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(value: &str) -> SessionToken {
        SessionToken::new(value)
    }

    #[test]
    fn cancellation_is_shared_only_by_session_generation_and_id() {
        let registry = Arc::new(DownloadRegistry::default());
        let host_a = session("host-a");
        let host_b = session("host-b");
        let first = registry.register_batch(&host_a, 4, "launch");
        let second = registry.register_batch(&host_a, 4, "launch");
        let other_generation = registry.register_batch(&host_a, 5, "launch");
        let other_session = registry.register_batch(&host_b, 4, "launch");
        let other_id = registry.register_batch(&host_a, 4, "metadata");

        assert!(registry.cancel(&host_a, 4, "launch"));
        assert!(first.cancellation().is_cancelled());
        assert!(second.cancellation().is_cancelled());
        assert!(!other_generation.cancellation().is_cancelled());
        assert!(!other_session.cancellation().is_cancelled());
        assert!(!other_id.cancellation().is_cancelled());
    }

    #[test]
    fn cancellation_id_is_fresh_after_every_batch_deregisters() {
        let registry = Arc::new(DownloadRegistry::default());
        let host = session("host");
        let old_token = {
            let registration = registry.register_batch(&host, 1, "launch");
            assert!(registry.cancel(&host, 1, "launch"));
            registration.cancellation()
        };
        let fresh = registry.register_batch(&host, 1, "launch");

        assert!(old_token.is_cancelled());
        assert!(!fresh.cancellation().is_cancelled());
    }

    #[test]
    fn page_reset_cancels_every_registered_batch() {
        let registry = Arc::new(DownloadRegistry::default());
        let first = registry.register_batch(&session("host-a"), 1, "launch");
        let second = registry.register_batch(&session("host-b"), 2, "metadata");

        registry.cancel_all();

        assert!(first.cancellation().is_cancelled());
        assert!(second.cancellation().is_cancelled());
    }

    #[test]
    fn registration_after_generation_revocation_starts_cancelled() {
        let registry = Arc::new(DownloadRegistry::default());
        let host = session("host");
        registry.cancel_generation(7);

        let stale = registry.register_batch(&host, 7, "launch");
        let fresh = registry.register_batch(&host, 8, "launch");

        assert!(stale.cancellation().is_cancelled());
        assert!(!fresh.cancellation().is_cancelled());
    }

    #[test]
    fn destination_leases_reject_collisions_until_release() {
        let registry = Arc::new(DownloadRegistry::default());
        let destination = std::env::temp_dir().join("kaede-collision-test.bin");
        let first = registry
            .try_lease_destination(destination.clone())
            .expect("first destination lease should succeed");

        assert!(registry.try_lease_destination(destination.clone()).is_err());
        #[cfg(any(windows, target_os = "macos"))]
        if !destination_directory_is_case_sensitive(&destination).unwrap_or(false) {
            assert!(registry
                .try_lease_destination(destination.with_file_name("KAEDE-COLLISION-TEST.BIN"))
                .is_err());
        }
        drop(first);
        assert!(registry.try_lease_destination(destination).is_ok());
    }

    #[test]
    fn partial_guard_cleans_up_and_commit_replaces_atomically() {
        let root = std::env::temp_dir().join(format!(
            "kaede-download-partial-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock should follow Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).expect("test directory should exist");
        let destination = root.join("artifact.bin");
        let abandoned = root.join(".artifact.abandoned.part");
        std::fs::write(&abandoned, b"partial").expect("partial should be writable");
        drop(PartialDownload::new(abandoned.clone()));
        assert!(!abandoned.exists());

        std::fs::write(&destination, b"old").expect("destination should be writable");
        let completed = root.join(".artifact.completed.part");
        std::fs::write(&completed, b"new").expect("completed partial should be writable");
        PartialDownload::new(completed.clone())
            .commit(&destination)
            .expect("commit should replace the destination");
        assert_eq!(
            std::fs::read(&destination).expect("destination should remain readable"),
            b"new"
        );
        assert!(!completed.exists());

        let _ = std::fs::remove_dir_all(root);
    }
}

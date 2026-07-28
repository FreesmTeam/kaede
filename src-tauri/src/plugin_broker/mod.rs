pub(crate) mod authorizer;
pub(crate) mod commands;
mod decisions;
mod processes;
pub(crate) use processes::BrokerEvent;

use authorizer::{Authorizer, PermissionId, ResourceHandle, SessionToken};
use cap_fs_ext::MetadataExt;
use cap_std::ambient_authority;
use cap_std::fs::Dir;
use decisions::DecisionStore;
pub(crate) use decisions::replace_file;
use processes::ProcessStore;
use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI32, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use tauri::{Manager, Runtime, Webview};
use tokio::sync::Notify;

pub struct BrokerState {
    authorizer: Mutex<Authorizer>,
    page_generation: AtomicU64,
    launch_count: AtomicI32,
    runtime_paths: Option<crate::launcher::RuntimePaths>,
    decisions: DecisionStore,
    processes: ProcessStore,
    process_finalization: Mutex<()>,
    storage_roots: StorageRootStore,
    operations: OperationRegistry,
    downloads: Arc<crate::downloads::DownloadRegistry>,
    log_tail: crate::logging::LogTail,
}

impl BrokerState {
    pub fn new(decisions_path: PathBuf) -> io::Result<Self> {
        let log_path = decisions_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("latest.log");
        Ok(Self {
            authorizer: Mutex::new(Authorizer::new()),
            page_generation: AtomicU64::new(0),
            launch_count: AtomicI32::new(0),
            runtime_paths: None,
            storage_roots: StorageRootStore::new(&decisions_path)?,
            decisions: DecisionStore::new(decisions_path),
            processes: ProcessStore::default(),
            process_finalization: Mutex::new(()),
            operations: OperationRegistry::default(),
            downloads: Arc::new(crate::downloads::DownloadRegistry::default()),
            log_tail: crate::logging::LogTail::new(log_path),
        })
    }

    pub fn new_for_runtime(runtime_paths: crate::launcher::RuntimePaths) -> io::Result<Self> {
        let decisions_path = runtime_paths.capability_decisions_path();
        let mut state = Self::new(decisions_path)?;
        state.log_tail = crate::logging::LogTail::new(
            runtime_paths.base_directory.join("logs").join("latest.log"),
        );
        state.runtime_paths = Some(runtime_paths);
        Ok(state)
    }

    fn launch_count(&self) -> i32 {
        self.launch_count.load(Ordering::SeqCst)
    }

    fn runtime_paths(&self) -> Option<&crate::launcher::RuntimePaths> {
        self.runtime_paths.as_ref()
    }
}

#[derive(Debug)]
enum ProcessRegistrationError {
    Authorization(authorizer::BrokerError),
    Spawn(String),
}

fn register_process_resource<T>(
    state: &BrokerState,
    owner: &SessionToken,
    handle: &ResourceHandle,
    register: impl FnOnce() -> Result<T, String>,
) -> Result<T, ProcessRegistrationError> {
    let mut authorizer = state
        .authorizer
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    authorizer
        .bind_resource(owner, handle.clone())
        .map_err(ProcessRegistrationError::Authorization)?;
    let registration = register();
    match registration {
        Ok(registered) => Ok(registered),
        Err(message) => {
            authorizer.release_resource(handle);
            Err(ProcessRegistrationError::Spawn(message))
        }
    }
}

fn terminate_processes(state: &BrokerState, handles: &[ResourceHandle]) -> Result<(), String> {
    let _finalization = state
        .process_finalization
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let summary = state.processes.kill_all(handles);
    if !summary.killed.is_empty() {
        let mut authorizer = state
            .authorizer
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        for handle in summary.killed {
            authorizer.release_resource(&handle);
        }
    }
    for terminal_failure in summary.terminal_failures {
        terminal_failure.send();
    }
    if summary.failures.is_empty() {
        return Ok(());
    }

    Err(summary
        .failures
        .into_iter()
        .map(|failure| format!("{}: {}", failure.handle.as_str(), failure.message))
        .collect::<Vec<_>>()
        .join("; "))
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct StorageRootKey {
    session: SessionToken,
    permission: PermissionId,
    canonical_root: PathBuf,
}

struct PreparedStorageRoot {
    permission: PermissionId,
    canonical_root: PathBuf,
    identity: FileIdentity,
    directory: Arc<Dir>,
}

struct StorageTarget {
    directory: Arc<Dir>,
    relative_path: PathBuf,
    permission: PermissionId,
    canonical_path: PathBuf,
    internal: bool,
}

struct StorageRootStore {
    private_state_root: PathBuf,
    trusted_plugin_data: Arc<Dir>,
    trusted_plugin_data_path: PathBuf,
    roots: Mutex<BTreeMap<StorageRootKey, Arc<Dir>>>,
}

impl StorageRootStore {
    fn new(decisions_path: &Path) -> io::Result<Self> {
        let app_data = decisions_path.parent().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "decision store has no application data parent",
            )
        })?;
        std::fs::create_dir_all(app_data)?;
        let private_state_root = std::fs::canonicalize(app_data)?;
        let trusted_plugin_data_path = private_state_root
            .join("capability-broker")
            .join("plugin-data")
            .join("v1");
        std::fs::create_dir_all(&trusted_plugin_data_path)?;
        let trusted_plugin_data_path = std::fs::canonicalize(trusted_plugin_data_path)?;
        let trusted_plugin_data =
            Dir::open_ambient_dir(&trusted_plugin_data_path, ambient_authority())?;
        Ok(Self {
            private_state_root,
            trusted_plugin_data: Arc::new(trusted_plugin_data),
            trusted_plugin_data_path,
            roots: Mutex::new(BTreeMap::new()),
        })
    }

    fn principal_path(&self, principal_relative_path: &Path) -> PathBuf {
        self.trusted_plugin_data_path.join(principal_relative_path)
    }

    fn prepare_internal(
        &self,
        permission: PermissionId,
        principal_relative_path: &Path,
    ) -> io::Result<PreparedStorageRoot> {
        self.trusted_plugin_data
            .create_dir_all(principal_relative_path)?;
        let directory = self.trusted_plugin_data.open_dir(principal_relative_path)?;
        Ok(PreparedStorageRoot {
            permission,
            canonical_root: self.principal_path(principal_relative_path),
            identity: FileIdentity::from_metadata(&directory.dir_metadata()?),
            directory: Arc::new(directory),
        })
    }

    fn prepare_external(
        &self,
        permission: PermissionId,
        requested_root: &Path,
    ) -> io::Result<PreparedStorageRoot> {
        let canonical_root = std::fs::canonicalize(requested_root)?;
        self.ensure_external_path_is_delegable(&canonical_root)?;
        let confirmed_directory = Dir::open_ambient_dir(&canonical_root, ambient_authority())?;
        let expected_identity = FileIdentity::from_metadata(&confirmed_directory.dir_metadata()?);
        let directory = open_verified_directory(&canonical_root, expected_identity)?;
        drop(confirmed_directory);
        Ok(PreparedStorageRoot {
            permission,
            canonical_root,
            identity: expected_identity,
            directory: Arc::new(directory),
        })
    }

    fn install(&self, session: &SessionToken, prepared: Vec<PreparedStorageRoot>) {
        let mut roots = self
            .roots
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        for prepared_root in prepared {
            roots.insert(
                StorageRootKey {
                    session: session.clone(),
                    permission: prepared_root.permission,
                    canonical_root: prepared_root.canonical_root,
                },
                prepared_root.directory,
            );
        }
    }

    fn resolve(
        &self,
        session: &SessionToken,
        permission: PermissionId,
        canonical_path: &std::path::Path,
    ) -> io::Result<StorageTarget> {
        self.ensure_external_path_is_delegable(canonical_path)?;
        let roots = self
            .roots
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let (key, directory, relative_path) = roots
            .iter()
            .filter(|(key, _)| key.session == *session && key.permission == permission)
            .filter_map(|(key, directory)| {
                canonical_path
                    .strip_prefix(&key.canonical_root)
                    .ok()
                    .map(|relative_path| (key, directory, relative_path))
            })
            .max_by_key(|(key, _, _)| key.canonical_root.components().count())
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "authorized storage root handle is unavailable",
                )
            })?;
        self.ensure_external_path_is_delegable(&key.canonical_root)?;
        Ok(StorageTarget {
            directory: Arc::clone(directory),
            relative_path: relative_path.to_path_buf(),
            permission,
            canonical_path: canonical_path.to_path_buf(),
            internal: false,
        })
    }

    fn ensure_external_path_is_delegable(&self, canonical_path: &Path) -> io::Result<()> {
        if canonical_path.starts_with(&self.private_state_root)
            || self.private_state_root.starts_with(canonical_path)
        {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "external storage cannot overlap Kaede private application data",
            ));
        }
        Ok(())
    }

    fn resolve_internal(
        &self,
        session: &SessionToken,
        permission: PermissionId,
        relative_path: &Path,
    ) -> io::Result<StorageTarget> {
        let roots = self
            .roots
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let (key, directory) = roots
            .iter()
            .find(|(key, _)| key.session == *session && key.permission == permission)
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "authorized internal storage root handle is unavailable",
                )
            })?;
        Ok(StorageTarget {
            directory: Arc::clone(directory),
            relative_path: relative_path.to_path_buf(),
            permission,
            canonical_path: key.canonical_root.join(relative_path),
            internal: true,
        })
    }

    fn remove_session(&self, session: &SessionToken) {
        self.roots
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .retain(|key, _| key.session != *session);
    }

    fn clear(&self) {
        self.roots
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clear();
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct FileIdentity {
    device: u64,
    inode: u64,
}

impl FileIdentity {
    fn from_metadata(metadata: &impl MetadataExt) -> Self {
        Self {
            device: metadata.dev(),
            inode: metadata.ino(),
        }
    }

    #[cfg(windows)]
    pub(super) fn from_file(file: &std::fs::File) -> io::Result<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle,
        };

        let mut information = BY_HANDLE_FILE_INFORMATION::default();
        // SAFETY: `information` is a valid writable output structure and the borrowed raw handle
        // remains owned by `file` for the duration of this call.
        let succeeded =
            unsafe { GetFileInformationByHandle(file.as_raw_handle().cast(), &mut information) };
        if succeeded == 0 {
            return Err(io::Error::last_os_error());
        }

        Ok(Self {
            device: u64::from(information.dwVolumeSerialNumber),
            inode: (u64::from(information.nFileIndexHigh) << 32)
                | u64::from(information.nFileIndexLow),
        })
    }

    fn device_string(self) -> String {
        self.device.to_string()
    }

    fn inode_string(self) -> String {
        self.inode.to_string()
    }

    fn matches_strings(self, device: &str, inode: &str) -> bool {
        device == self.device.to_string() && inode == self.inode.to_string()
    }
}

fn open_verified_directory(path: &Path, expected_identity: FileIdentity) -> io::Result<Dir> {
    let directory = Dir::open_ambient_dir(path, ambient_authority())?;
    let opened_identity = FileIdentity::from_metadata(&directory.dir_metadata()?);
    // Authorization approves the directory object confirmed above. A pathname reused for a
    // replacement object is not the same authorization identity.
    if opened_identity != expected_identity {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "storage root changed while its capability was opened",
        ));
    }
    Ok(directory)
}

#[derive(Default)]
struct OperationRegistry {
    sessions: Mutex<BTreeMap<SessionToken, Arc<SessionActivity>>>,
}

impl OperationRegistry {
    fn register(&self, session: SessionToken) {
        self.sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(session, Arc::new(SessionActivity::new()));
    }

    fn acquire(&self, session: &SessionToken) -> io::Result<OperationLease> {
        let activity = self
            .sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(session)
            .cloned()
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "plugin session is inactive",
                )
            })?;
        activity.acquire()
    }

    fn cancel(&self, session: &SessionToken) -> Option<Arc<SessionActivity>> {
        let activity = self
            .sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(session)
            .cloned();
        if let Some(activity) = activity.as_ref() {
            activity.cancel();
        }
        activity
    }

    fn remove(&self, session: &SessionToken) {
        self.sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(session);
    }

    fn cancel_all(&self) -> Vec<Arc<SessionActivity>> {
        let activities = self
            .sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .values()
            .cloned()
            .collect::<Vec<_>>();
        for activity in &activities {
            activity.cancel();
        }
        activities
    }

    fn clear(&self) {
        self.sessions
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clear();
    }
}

#[derive(Default)]
struct ActivityState {
    cancelled: bool,
    active: usize,
}

struct SessionActivity {
    state: Mutex<ActivityState>,
    quiescent: Condvar,
    quiescent_async: Notify,
}

impl SessionActivity {
    fn new() -> Self {
        Self {
            state: Mutex::new(ActivityState::default()),
            quiescent: Condvar::new(),
            quiescent_async: Notify::new(),
        }
    }

    fn acquire(self: Arc<Self>) -> io::Result<OperationLease> {
        {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            if state.cancelled {
                return Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "plugin session is being revoked",
                ));
            }
            state.active += 1;
        }
        Ok(OperationLease { activity: self })
    }

    fn cancel(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.cancelled = true;
        if state.active == 0 {
            self.quiescent.notify_all();
            self.quiescent_async.notify_waiters();
        }
    }

    async fn wait_quiescent(&self) {
        loop {
            let notified = self.quiescent_async.notified();
            if self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .active
                == 0
            {
                return;
            }
            notified.await;
        }
    }

    fn wait_quiescent_blocking(&self) {
        let state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        drop(
            self.quiescent
                .wait_while(state, |state| state.active != 0)
                .unwrap_or_else(std::sync::PoisonError::into_inner),
        );
    }
}

pub(super) struct OperationLease {
    activity: Arc<SessionActivity>,
}

impl Drop for OperationLease {
    fn drop(&mut self) {
        let mut state = self
            .activity
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.active -= 1;
        if state.active == 0 {
            self.activity.quiescent.notify_all();
            self.activity.quiescent_async.notify_waiters();
        }
    }
}

pub fn reset_for_page_load<R: Runtime>(webview: &Webview<R>) {
    if webview.label() != "main" {
        return;
    }
    let Some(state) = webview.try_state::<BrokerState>() else {
        return;
    };
    reset_state_for_page_load(&state);
}

fn reset_state_for_page_load(state: &BrokerState) {
    state.page_generation.fetch_add(1, Ordering::SeqCst);
    state.log_tail.stop();
    let mut authorizer = state
        .authorizer
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if let Some(host) = authorizer.active_host_session() {
        state.downloads.cancel_generation(host.generation);
    } else {
        state.downloads.cancel_all();
    }
    let completed_page_bootstrap = authorizer.active_host_session().is_some();
    let activities = state.operations.cancel_all();
    let handles = authorizer.reset_for_page_load();
    if completed_page_bootstrap {
        state.launch_count.fetch_add(1, Ordering::SeqCst);
    }
    drop(authorizer);
    if let Err(message) = terminate_processes(state, &handles) {
        log::error!(
            target: "capability_broker",
            "page reset could not terminate all broker processes; retained them for retry: {message}"
        );
    }
    for activity in activities {
        activity.wait_quiescent_blocking();
    }
    state.storage_roots.clear();
    state.operations.clear();
}

#[cfg(test)]
mod tests {
    use super::*;
    use authorizer::{Principal, SessionToken};
    use decisions::{DecisionKey, DecisionKind};

    #[test]
    fn backend_reset_revokes_sessions_before_next_bootstrap() {
        let state =
            BrokerState::new(test_decisions_path("reset")).expect("broker state should initialize");
        let old_host = SessionToken::new("old-host");
        let plugin = SessionToken::new("plugin");
        {
            let mut authorizer = state.authorizer.lock().expect("authorizer should lock");
            authorizer
                .bootstrap_host(old_host.clone(), 1)
                .expect("host should bootstrap");
            authorizer
                .open_plugin(
                    &old_host,
                    plugin.clone(),
                    Principal::new(
                        "https://plugins.example.test/owner/example",
                        "example.plugin",
                        "1.0.0",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                )
                .expect("plugin should open");
            assert!(authorizer.reset_for_page_load().is_empty());
            assert!(authorizer.active_host_session().is_none());
            assert!(
                authorizer
                    .plugin_session(&plugin)
                    .expect("plugin history should remain")
                    .revoked
            );
        }
    }

    #[test]
    fn backend_reset_recovers_a_poisoned_authorizer_lock() {
        let state = BrokerState::new(test_decisions_path("poison"))
            .expect("broker state should initialize");
        let host = SessionToken::new("host");
        lock_and_bootstrap(&state, &host);

        let poisoned = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state
                .authorizer
                .lock()
                .expect("authorizer should initially lock");
            panic!("poison the authorizer mutex for this test");
        }));
        assert!(poisoned.is_err());

        reset_state_for_page_load(&state);

        assert_eq!(state.page_generation.load(Ordering::SeqCst), 1);
        assert!(
            state
                .authorizer
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .active_host_session()
                .is_none()
        );
    }

    #[test]
    fn backend_reset_cancels_active_host_download_groups() {
        let state = BrokerState::new(test_decisions_path("download-reset"))
            .expect("broker state should initialize");
        let host = SessionToken::new("host");
        lock_and_bootstrap(&state, &host);
        let batch = state.downloads.register_batch(&host, 1, "launch");

        reset_state_for_page_load(&state);

        assert!(batch.cancellation().is_cancelled());
    }

    fn lock_and_bootstrap(state: &BrokerState, host: &SessionToken) {
        state
            .authorizer
            .lock()
            .expect("authorizer should lock")
            .bootstrap_host(host.clone(), 1)
            .expect("host should bootstrap");
    }

    fn test_decisions_path(name: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("kaede-broker-mod-{name}-{}", std::process::id()))
            .join("decisions.json")
    }

    #[test]
    fn verified_root_open_rejects_path_replacement() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock should follow the Unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "kaede-root-identity-{}-{}",
            std::process::id(),
            nonce
        ));
        let approved = root.join("approved");
        std::fs::create_dir_all(&approved).expect("approved directory should exist");
        let confirmed = Dir::open_ambient_dir(&approved, ambient_authority())
            .expect("approved directory should open");

        #[cfg(windows)]
        {
            std::fs::rename(&approved, root.join("approved-original"))
                .expect_err("the confirmed Windows directory handle must prevent replacement");
        }

        #[cfg(not(windows))]
        {
            let expected = FileIdentity::from_metadata(
                &confirmed
                    .dir_metadata()
                    .expect("approved metadata should be readable"),
            );
            std::fs::rename(&approved, root.join("approved-original"))
                .expect("approved object should move");
            std::fs::create_dir(&approved).expect("replacement directory should exist");

            let error = open_verified_directory(&approved, expected)
                .expect_err("replacement object must fail the identity check");
            assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
        }

        drop(confirmed);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn external_storage_roots_cannot_overlap_private_application_data() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock should follow the Unix epoch")
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "kaede-private-storage-root-{}-{}",
            std::process::id(),
            nonce
        ));
        let private_root = fixture_root.join("private-app-data");
        let state = BrokerState::new(private_root.join("capability-decisions.json"))
            .expect("broker state should initialize");
        let private_child = private_root.join("attacker-selected-child");
        let safe_sibling = fixture_root.join("safe-external");
        std::fs::create_dir_all(&private_child).expect("private child should exist");
        std::fs::create_dir_all(&safe_sibling).expect("safe sibling should exist");

        let mut forbidden_roots = vec![
            fixture_root.clone(),
            private_root.clone(),
            private_child.clone(),
        ];
        #[cfg(unix)]
        forbidden_roots.push(PathBuf::from("/"));

        for permission in [
            PermissionId::StorageExternalRead,
            PermissionId::StorageExternalWrite,
        ] {
            for forbidden_root in &forbidden_roots {
                let error = match state
                    .storage_roots
                    .prepare_external(permission, forbidden_root)
                {
                    Ok(_) => panic!("overlapping external root must be rejected"),
                    Err(error) => error,
                };
                assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
            }
            state
                .storage_roots
                .prepare_external(permission, &safe_sibling)
                .expect("a disjoint external root should remain delegable");
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let private_alias = fixture_root.join("private-alias");
            symlink(&private_root, &private_alias).expect("private root alias should be created");
            let error = match state
                .storage_roots
                .prepare_external(PermissionId::StorageExternalWrite, &private_alias)
            {
                Ok(_) => panic!("a symlink to private application data must be rejected"),
                Err(error) => error,
            };
            assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
        }

        let _ = std::fs::remove_dir_all(fixture_root);
    }

    #[test]
    fn portable_runtime_root_drives_persistence_and_external_overlap_rejection() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock should follow the Unix epoch")
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "kaede-portable-private-root-{}-{}",
            std::process::id(),
            nonce
        ));
        let executable_root = fixture_root.join("portable-runtime");
        let system_app_data = fixture_root.join("system-app-data");
        let portable_child = executable_root.join("plugin-selected-child");
        let safe_external = fixture_root.join("safe-external");
        std::fs::create_dir_all(&executable_root).expect("portable runtime root should exist");
        std::fs::create_dir_all(&system_app_data).expect("system app-data fixture should exist");
        std::fs::create_dir_all(&portable_child).expect("portable child should exist");
        std::fs::create_dir_all(&safe_external).expect("safe external fixture should exist");
        std::fs::write(executable_root.join("portable.txt"), b"")
            .expect("portable marker should exist");

        let runtime_paths = crate::launcher::select_runtime_paths_from(
            executable_root.clone(),
            system_app_data.clone(),
        )
        .expect("portable runtime paths should resolve");
        let canonical_portable_root =
            std::fs::canonicalize(&executable_root).expect("portable root should canonicalize");
        let decisions_path = runtime_paths.capability_decisions_path();
        assert!(runtime_paths.portable);
        assert_eq!(runtime_paths.base_directory, canonical_portable_root);
        assert_eq!(
            decisions_path,
            canonical_portable_root.join("capability-decisions.json")
        );

        let state = BrokerState::new_for_runtime(runtime_paths)
            .expect("portable broker state should initialize");
        state
            .decisions
            .save(
                DecisionKey {
                    kind: DecisionKind::Dynamic,
                    principal_key: "portable-test-principal".to_owned(),
                    request_fingerprint: "portable-test-request".to_owned(),
                },
                true,
            )
            .expect("portable decision should persist");
        assert!(decisions_path.is_file());
        assert!(!system_app_data.join("capability-decisions.json").exists());
        assert_eq!(
            state.storage_roots.private_state_root,
            canonical_portable_root
        );

        let forbidden_roots = [
            fixture_root.as_path(),
            executable_root.as_path(),
            portable_child.as_path(),
        ];
        for permission in [
            PermissionId::StorageExternalRead,
            PermissionId::StorageExternalWrite,
        ] {
            for forbidden_root in forbidden_roots {
                let error = match state
                    .storage_roots
                    .prepare_external(permission, forbidden_root)
                {
                    Ok(_) => panic!("portable private root overlap must be rejected"),
                    Err(error) => error,
                };
                assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
            }
            state
                .storage_roots
                .prepare_external(permission, &safe_external)
                .expect("a disjoint external root should remain delegable");
        }

        let _ = std::fs::remove_dir_all(fixture_root);
    }
}

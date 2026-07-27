use super::authorizer::{
    BrokerError as AuthorizationError, CapabilityGrant, ExternalStorageScope, HttpMethod,
    HttpOrigin, HttpRule, InternalStorageScope, NetworkScope, Operation, PermissionId,
    PermissionScope, Principal, ProcessRule, ProcessScope, ProcessTargetIdentity, ResourceHandle,
    SessionToken,
};
use super::decisions::{DecisionKey, DecisionKind};
use super::processes::{
    forward_events, send_broker_event, BrokerEvent, ProcessArtifacts, ProcessCommand,
    ProcessStreamEnd,
};
use super::{
    register_process_resource, terminate_processes, BrokerState, FileIdentity,
    ProcessRegistrationError,
};
use crate::downloads::{
    DestinationLease, DownloadCancellation, DownloadEntry, DownloadReport, FailedDownload,
    PartialDownload,
};
use crate::{extensions, finalization, hashes, launcher, zip};
use cap_fs_ext::{DirExt, MetadataExt};
use cap_std::fs::{File as CapabilityFile, OpenOptions as CapabilityOpenOptions};
use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "linux", windows))]
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs::File;
use std::future::{poll_fn, Future};
use std::io::{Read, Write};
#[cfg(any(target_os = "linux", windows))]
use std::io::{Seek, SeekFrom};
use std::net::{IpAddr, SocketAddr};
use std::path::{Component, Path, PathBuf};
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::task::Poll;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tauri::ipc::{Channel, JavaScriptChannelId};
use tauri::{AppHandle, Manager, Runtime, State, Webview};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_http::reqwest;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shellx::process::CommandEvent;
use tauri_plugin_shellx::ShellExt;

const MAIN_WEBVIEW_LABEL: &str = "main";
static SYSTEM_CPU: Mutex<Option<System>> = Mutex::new(None);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapResponse {
    session: SessionToken,
    generation: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrincipalInput {
    repository_origin: String,
    plugin_id: String,
    version: String,
    artifact_sha256: String,
}

impl From<PrincipalInput> for Principal {
    fn from(value: PrincipalInput) -> Self {
        Self::new(
            value.repository_origin,
            value.plugin_id,
            value.version,
            value.artifact_sha256,
        )
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum PermissionDescriptor {
    Simple(PermissionId),
    Structured(StructuredPermissionDescriptor),
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "id", deny_unknown_fields)]
pub enum StructuredPermissionDescriptor {
    #[serde(rename = "network/http")]
    NetworkHttp { scope: NetworkDescriptorScope },
    #[serde(rename = "storage/internal/read")]
    StorageInternalRead { scope: InternalDescriptorScope },
    #[serde(rename = "storage/internal/write")]
    StorageInternalWrite { scope: InternalDescriptorScope },
    #[serde(rename = "storage/external/read")]
    StorageExternalRead { scope: ExternalDescriptorScope },
    #[serde(rename = "storage/external/write")]
    StorageExternalWrite { scope: ExternalDescriptorScope },
    #[serde(rename = "system/process/spawn")]
    SystemProcessSpawn { scope: ProcessDescriptorScope },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NetworkDescriptorScope {
    origins: Vec<String>,
    methods: Vec<HttpMethod>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InternalDescriptorScope {
    directory: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ExternalDescriptorScope {
    roots: Vec<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProcessDescriptorScope {
    executables: Vec<ProcessExecutableDescriptor>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProcessExecutableDescriptor {
    path: PathBuf,
    arguments: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionTargetKind {
    ExternalStorageRoot,
    ProcessExecutable,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
pub enum PermissionTargetIdentityProvider {
    #[serde(rename = "desktop-filesystem-v1")]
    DesktopFilesystemV1,
    #[serde(rename = "desktop-executable-sha256-v1")]
    DesktopExecutableSha256V1,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PermissionTargetIdentity {
    kind: PermissionTargetKind,
    path: PathBuf,
    identity_provider: PermissionTargetIdentityProvider,
    device: String,
    inode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content_sha256: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawPermissionTargetIdentity {
    kind: PermissionTargetKind,
    path: PathBuf,
    identity_provider: PermissionTargetIdentityProvider,
    device: String,
    inode: String,
    content_sha256: Option<String>,
}

impl<'de> Deserialize<'de> for PermissionTargetIdentity {
    fn deserialize<Deserializer>(deserializer: Deserializer) -> Result<Self, Deserializer::Error>
    where
        Deserializer: serde::Deserializer<'de>,
    {
        let raw = RawPermissionTargetIdentity::deserialize(deserializer)?;
        let provider_matches_material = match (
            raw.identity_provider,
            raw.kind,
            raw.content_sha256.as_deref(),
        ) {
            (
                PermissionTargetIdentityProvider::DesktopFilesystemV1,
                PermissionTargetKind::ExternalStorageRoot,
                None,
            ) => true,
            (
                PermissionTargetIdentityProvider::DesktopExecutableSha256V1,
                PermissionTargetKind::ProcessExecutable,
                Some(content_sha256),
            ) => is_lowercase_sha256(content_sha256),
            _ => false,
        };
        if !provider_matches_material {
            return Err(serde::de::Error::custom(
                "permission target identity provider does not match its material",
            ));
        }

        Ok(Self {
            kind: raw.kind,
            path: raw.path,
            identity_provider: raw.identity_provider,
            device: raw.device,
            inode: raw.inode,
            content_sha256: raw.content_sha256,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreparedPermissionDescriptor {
    descriptor: PermissionDescriptor,
    target_identities: Vec<PermissionTargetIdentity>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HttpHeader {
    name: String,
    value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HttpRequest {
    url: String,
    method: HttpMethod,
    #[serde(default)]
    headers: Vec<HttpHeader>,
    body: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProcessSpec {
    executable: PathBuf,
    #[serde(default)]
    arguments: Vec<String>,
    cwd: Option<PathBuf>,
    #[serde(default)]
    environment: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShellSpec {
    script: String,
    cwd: Option<PathBuf>,
    #[serde(default)]
    environment: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum BrokerRequest {
    OpenPlugin {
        principal: PrincipalInput,
    },
    PreparePermissionRequests {
        descriptors: Vec<PermissionDescriptor>,
    },
    GrantPlugin {
        plugin_session: SessionToken,
        prepared: PreparedPermissionDescriptor,
    },
    RevokePlugin {
        plugin_session: SessionToken,
    },
    DecisionLoad {
        decision_kind: DecisionKind,
        principal_key: String,
        request_fingerprint: String,
    },
    DecisionSave {
        decision_kind: DecisionKind,
        principal_key: String,
        request_fingerprint: String,
        decision: bool,
    },
    HostInitialState,
    HostFinalizeInitialization {
        base_directory: String,
        folders: Vec<String>,
        java_binary: String,
    },
    HostRuntimeSnapshot,
    HostSystemMemory,
    HostGlobalCpuUsage,
    HostHashMd5 {
        bytes: Vec<u8>,
    },
    HostHashSha256 {
        bytes: Vec<u8>,
    },
    HostReadExtensions {},
    HostFsExists {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostFsMetadata {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostFsExistsMany {
        paths: Vec<PathBuf>,
        base_directory: Option<PathBuf>,
    },
    HostFsReadText {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostFsWriteText {
        path: PathBuf,
        contents: String,
        base_directory: Option<PathBuf>,
    },
    HostFsReadDir {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostFsEnsureDirectories {
        paths: Vec<PathBuf>,
        base_directory: Option<PathBuf>,
        recursive: bool,
    },
    HostFsRename {
        source: PathBuf,
        destination: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostFsReadBytes {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostPickAndCopyIcon {
        destination_directory: PathBuf,
        allowed_extensions: Vec<String>,
        title: Option<String>,
    },
    HostHttpFetch {
        request: HttpRequest,
    },
    HostHttpDownload {
        request: HttpRequest,
        destination: PathBuf,
        base_directory: Option<PathBuf>,
    },
    HostDownloadBatch {
        entries: Vec<DownloadEntry>,
        concurrency: usize,
        label: String,
        cancel_id: String,
    },
    HostCancelDownloads {
        cancel_id: String,
    },
    HostProbeJavaMajor,
    HostLaunchMinecraft {
        executable: PathBuf,
        arguments: Vec<String>,
        cwd: PathBuf,
        instance_id: String,
    },
    HostServeFile {
        name: String,
        file_path: PathBuf,
    },
    HostServeCode {
        name: String,
        code: String,
    },
    MissingPaths {
        paths: Vec<PathBuf>,
    },
    VerifySha1 {
        artifacts: Vec<launcher::Artifact>,
    },
    Unzip {
        archive: PathBuf,
        target_directory: PathBuf,
    },
    PluginFsReadText {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    PluginFsWriteText {
        path: PathBuf,
        contents: String,
        base_directory: Option<PathBuf>,
    },
    PluginFsWriteBytes {
        path: PathBuf,
        bytes: Vec<u8>,
    },
    PluginFsRemove {
        path: PathBuf,
    },
    PluginFsReadBytes {
        path: PathBuf,
        base_directory: Option<PathBuf>,
    },
    Log {
        level: LogLevel,
        message: String,
        location: Option<String>,
    },
    DialogAsk {
        title: Option<String>,
        message: String,
        dialog_kind: DialogKind,
    },
    DialogMessage {
        title: Option<String>,
        message: String,
        dialog_kind: DialogKind,
    },
    OpenerReveal {
        path: PathBuf,
    },
    PluginHttpFetch {
        request: HttpRequest,
    },
    PluginProcessSpawn {
        process: ProcessSpec,
    },
    ShellExecute {
        shell: ShellSpec,
    },
    ProcessKill {
        handle: ResourceHandle,
    },
}

impl BrokerRequest {
    fn requires_storage_lease(&self) -> bool {
        matches!(
            self,
            Self::PluginFsReadText { .. }
                | Self::PluginFsWriteText { .. }
                | Self::PluginFsWriteBytes { .. }
                | Self::PluginFsRemove { .. }
                | Self::PluginFsReadBytes { .. }
        )
    }
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DialogKind {
    Info,
    Warning,
    Error,
}

impl From<DialogKind> for MessageDialogKind {
    fn from(value: DialogKind) -> Self {
        match value {
            DialogKind::Info => Self::Info,
            DialogKind::Warning => Self::Warning,
            DialogKind::Error => Self::Error,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum BrokerResponse {
    PluginOpened {
        session: SessionToken,
    },
    PermissionRequestsPrepared {
        descriptors: Vec<PreparedPermissionDescriptor>,
    },
    PluginGranted,
    PluginRevoked {
        already_revoked: bool,
    },
    Decision {
        decision: Option<bool>,
    },
    DecisionSaved,
    InitialState {
        state: launcher::InitialState,
    },
    InitializationFinalized {
        report: finalization::LauncherInitReport,
    },
    ExtensionsRead {
        result: extensions::ExtensionsReadResult,
    },
    Paths {
        paths: Vec<PathBuf>,
    },
    Unit,
    Exists {
        exists: bool,
    },
    FileMetadata {
        modified_time_milliseconds: Option<u64>,
    },
    SystemMemory {
        used_bytes: u64,
        total_bytes: u64,
    },
    GlobalCpuUsage {
        usage: f32,
    },
    Text {
        text: String,
    },
    DirectoryEntries {
        entries: Vec<DirectoryEntry>,
    },
    Bytes {
        bytes: Vec<u8>,
    },
    Boolean {
        value: bool,
    },
    Http {
        response: HttpResponse,
    },
    DownloadReport {
        success: usize,
        failed: usize,
        cancelled: bool,
        failures: Vec<FailedDownload>,
    },
    ProcessOutput {
        code: Option<i32>,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
    },
    ProcessSpawned {
        handle: ResourceHandle,
        pid: u32,
    },
    RuntimeSnapshot {
        runtime_kind: RuntimeKind,
        launch_count: i32,
        portable: bool,
        base_directory: PathBuf,
        executable_directory: PathBuf,
        app_data_directory: PathBuf,
        os: RuntimeOsInfo,
    },
    Booleans {
        values: Vec<bool>,
    },
    IconPicked {
        icon: Option<PickedIcon>,
    },
    JavaMajor {
        major: u32,
    },
    ServerSpawned {
        handle: ResourceHandle,
        pid: u32,
        port: u16,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedIcon {
    path: PathBuf,
    bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeKind {
    Desktop,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOsInfo {
    platform: String,
    arch: String,
    version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    name: String,
    is_directory: bool,
    is_file: bool,
    is_symlink: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    status: u16,
    status_text: String,
    headers: Vec<HttpHeader>,
    body: Vec<u8>,
    url: String,
    redirected: bool,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CommandError {
    WrongWebview,
    InvalidRequest {
        message: String,
    },
    Unauthorized {
        message: String,
    },
    OperationFailed {
        operation: &'static str,
        message: String,
    },
    Internal {
        message: String,
    },
}

impl From<AuthorizationError> for CommandError {
    fn from(error: AuthorizationError) -> Self {
        Self::Unauthorized {
            message: error.to_string(),
        }
    }
}

#[tauri::command]
pub fn bootstrap_capability_broker<R: Runtime>(
    webview: Webview<R>,
    state: State<'_, BrokerState>,
) -> Result<BootstrapResponse, CommandError> {
    require_main_webview(&webview)?;
    bootstrap_state(&state)
}

fn bootstrap_state(state: &BrokerState) -> Result<BootstrapResponse, CommandError> {
    let session = random_session_token()?;
    let generation = state.page_generation.load(Ordering::SeqCst);
    let mut authorizer = lock_authorizer(state);
    authorizer.bootstrap_host(session.clone(), generation)?;
    Ok(BootstrapResponse {
        session,
        generation,
    })
}

#[tauri::command]
pub async fn capability_call<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    state: State<'_, BrokerState>,
    session: SessionToken,
    request: BrokerRequest,
    events: Option<JavaScriptChannelId>,
) -> Result<BrokerResponse, CommandError> {
    require_main_webview(&webview)?;
    let events = events.map(|channel| channel.channel_on(webview));
    dispatch(&app, &state, &session, request, events).await
}

fn runtime_paths<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
) -> Result<launcher::RuntimePaths, CommandError> {
    state.runtime_paths().cloned().map_or_else(
        || {
            launcher::select_runtime_paths(app)
                .map_err(|error| operation_error("runtime_paths", error))
        },
        Ok,
    )
}

fn read_system_memory() -> (u64, u64) {
    let mut system = System::new();

    system.refresh_memory();

    (system.used_memory(), system.total_memory())
}

fn read_global_cpu_usage() -> f32 {
    let mut guard = SYSTEM_CPU
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let system = guard.get_or_insert_with(|| {
        let mut system = System::new();

        system.refresh_cpu_usage();
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);

        system
    });

    system.refresh_cpu_usage();
    system.global_cpu_usage()
}

fn system_time_to_milliseconds(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH).map_or_else(
        |error| error.duration().as_millis() as u64,
        |duration| duration.as_millis() as u64,
    )
}

async fn dispatch<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    request: BrokerRequest,
    events: Option<Channel<BrokerEvent>>,
) -> Result<BrokerResponse, CommandError> {
    let _operation_lease = if request.requires_storage_lease()
        && matches!(active_session(state, session), Ok(ActiveSession::Plugin(_)))
    {
        Some(
            state
                .operations
                .acquire(session)
                .map_err(|error| operation_error("plugin_storage_lease", error))?,
        )
    } else {
        None
    };
    match request {
        BrokerRequest::OpenPlugin { principal } => {
            require_host(state, session)?;
            let plugin_session = random_session_token()?;
            let mut authorizer = lock_authorizer(state);
            authorizer.open_plugin(session, plugin_session.clone(), principal.into())?;
            state.operations.register(plugin_session.clone());
            Ok(BrokerResponse::PluginOpened {
                session: plugin_session,
            })
        }
        BrokerRequest::PreparePermissionRequests { descriptors } => {
            require_host(state, session)?;
            let descriptors = descriptors
                .into_iter()
                .map(|descriptor| prepare_permission_descriptor(state, descriptor))
                .collect::<Result<Vec<_>, _>>()?;
            Ok(BrokerResponse::PermissionRequestsPrepared { descriptors })
        }
        BrokerRequest::GrantPlugin {
            plugin_session,
            prepared,
        } => {
            require_host(state, session)?;
            let principal = lock_authorizer(state)
                .plugin_session(&plugin_session)
                .ok_or(AuthorizationError::InvalidSessionToken)?
                .principal
                .clone();
            let prepared = build_grant(state, &principal, prepared)?;
            grant_plugin_state(state, session, &plugin_session, &principal, prepared)?;
            Ok(BrokerResponse::PluginGranted)
        }
        BrokerRequest::RevokePlugin { plugin_session } => {
            revoke_plugin_state(state, session, &plugin_session).await
        }
        BrokerRequest::DecisionLoad {
            decision_kind,
            principal_key,
            request_fingerprint,
        } => {
            require_host(state, session)?;
            let decision = state
                .decisions
                .load(&DecisionKey {
                    kind: decision_kind,
                    principal_key,
                    request_fingerprint,
                })
                .map_err(|error| operation_error("decision_load", error))?;
            Ok(BrokerResponse::Decision { decision })
        }
        BrokerRequest::DecisionSave {
            decision_kind,
            principal_key,
            request_fingerprint,
            decision,
        } => {
            require_host(state, session)?;
            state
                .decisions
                .save(
                    DecisionKey {
                        kind: decision_kind,
                        principal_key,
                        request_fingerprint,
                    },
                    decision,
                )
                .map_err(|error| operation_error("decision_save", error))?;
            Ok(BrokerResponse::DecisionSaved)
        }
        BrokerRequest::HostInitialState => {
            require_host(state, session)?;
            let runtime_paths = runtime_paths(app, state)?;
            let state = launcher::get_initial_state(app, state.launch_count(), &runtime_paths)
                .await
                .map_err(|error| operation_error("initial_state", error))?;
            Ok(BrokerResponse::InitialState { state })
        }
        BrokerRequest::HostFinalizeInitialization {
            base_directory,
            folders,
            java_binary,
        } => {
            require_host(state, session)?;
            let report =
                finalization::finalize_initialization(base_directory, folders, java_binary)
                    .await
                    .map_err(|error| operation_error("finalize_initialization", error))?;
            Ok(BrokerResponse::InitializationFinalized { report })
        }
        BrokerRequest::HostRuntimeSnapshot => {
            require_host(state, session)?;
            let runtime_paths = runtime_paths(app, state)?;
            Ok(BrokerResponse::RuntimeSnapshot {
                runtime_kind: RuntimeKind::Desktop,
                launch_count: state.launch_count(),
                portable: runtime_paths.portable,
                base_directory: runtime_paths.base_directory,
                executable_directory: runtime_paths.executable_directory,
                app_data_directory: runtime_paths.app_data_directory,
                os: RuntimeOsInfo {
                    platform: tauri_plugin_os::platform().to_owned(),
                    arch: tauri_plugin_os::arch().to_owned(),
                    version: tauri_plugin_os::version().to_string(),
                },
            })
        }
        BrokerRequest::HostSystemMemory => {
            require_host(state, session)?;
            let (used_bytes, total_bytes) =
                tokio::task::spawn_blocking(read_system_memory)
                    .await
                    .map_err(|error| operation_error("host_system_memory", error))?;
            Ok(BrokerResponse::SystemMemory {
                used_bytes,
                total_bytes,
            })
        }
        BrokerRequest::HostGlobalCpuUsage => {
            require_host(state, session)?;
            let usage = tokio::task::spawn_blocking(read_global_cpu_usage)
                .await
                .map_err(|error| operation_error("host_global_cpu_usage", error))?;
            Ok(BrokerResponse::GlobalCpuUsage { usage })
        }
        BrokerRequest::HostHashMd5 { bytes } => {
            require_host(state, session)?;
            let text = tokio::task::spawn_blocking(move || hashes::md5_hex(&bytes))
                .await
                .map_err(|error| operation_error("host_hash_md5", error))?;
            Ok(BrokerResponse::Text { text })
        }
        BrokerRequest::HostHashSha256 { bytes } => {
            require_host(state, session)?;
            let text = tokio::task::spawn_blocking(move || hashes::sha256_hex(&bytes))
                .await
                .map_err(|error| operation_error("host_hash_sha256", error))?;
            Ok(BrokerResponse::Text { text })
        }
        BrokerRequest::HostReadExtensions {} => {
            require_host(state, session)?;
            let extensions_dir = runtime_paths(app, state)?.base_directory.join("extensions");
            let result =
                tokio::task::spawn_blocking(move || extensions::read_extensions(&extensions_dir))
                    .await
                    .map_err(|error| operation_error("host_read_extensions", error))?
                    .map_err(|error| operation_error("host_read_extensions", error))?;
            Ok(BrokerResponse::ExtensionsRead { result })
        }
        BrokerRequest::MissingPaths { paths } => {
            require_host(state, session)?;
            let paths = tokio::task::spawn_blocking(move || launcher::missing_files(paths))
                .await
                .map_err(|error| operation_error("missing_paths", error))?;
            Ok(BrokerResponse::Paths { paths })
        }
        BrokerRequest::VerifySha1 { artifacts } => {
            require_host(state, session)?;
            let paths = tokio::task::spawn_blocking(move || launcher::verify_file_paths(artifacts))
                .await
                .map_err(|error| operation_error("verify_sha1", error))?;
            Ok(BrokerResponse::Paths { paths })
        }
        BrokerRequest::Unzip {
            archive,
            target_directory,
        } => {
            require_host(state, session)?;
            tokio::task::spawn_blocking(move || zip::unzip_file(archive, target_directory))
                .await
                .map_err(|error| operation_error("unzip", error))?
                .map_err(|error| operation_error("unzip", error))?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::HostFsExists {
            path,
            base_directory,
        } => {
            require_host(state, session)?;
            let resolved = resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Read,
                false,
            )?;
            Ok(BrokerResponse::Exists {
                exists: resolved.exists(),
            })
        }
        BrokerRequest::HostFsMetadata {
            path,
            base_directory,
        } => {
            require_host(state, session)?;
            let path = resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Read,
                true,
            )?;
            let metadata = std::fs::metadata(path)
                .map_err(|error| operation_error("host_fs_metadata", error))?;
            Ok(BrokerResponse::FileMetadata {
                modified_time_milliseconds: metadata
                    .modified()
                    .ok()
                    .map(system_time_to_milliseconds),
            })
        }
        BrokerRequest::HostFsExistsMany {
            paths,
            base_directory,
        } => {
            require_host(state, session)?;
            let values = paths
                .iter()
                .map(|path| {
                    resolve_storage_path(
                        state,
                        session,
                        path,
                        base_directory.as_deref(),
                        StorageAccess::Read,
                        false,
                    )
                    .map(|resolved| resolved.exists())
                })
                .collect::<Result<Vec<_>, _>>()?;
            Ok(BrokerResponse::Booleans { values })
        }
        BrokerRequest::HostFsReadText {
            path,
            base_directory,
        } => {
            require_host(state, session)?;
            let path = resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Read,
                true,
            )?;
            let text = std::fs::read_to_string(path)
                .map_err(|error| operation_error("host_fs_read_text", error))?;
            Ok(BrokerResponse::Text { text })
        }
        BrokerRequest::HostFsWriteText {
            path,
            contents,
            base_directory,
        } => {
            require_host(state, session)?;
            let path = resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Write,
                false,
            )?;
            std::fs::write(path, contents)
                .map_err(|error| operation_error("host_fs_write_text", error))?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::HostFsReadDir {
            path,
            base_directory,
        } => {
            require_host(state, session)?;
            read_directory_response(resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Read,
                true,
            )?)
        }
        BrokerRequest::HostFsEnsureDirectories {
            paths,
            base_directory,
            recursive,
        } => {
            require_host(state, session)?;
            for path in paths {
                let path = if recursive {
                    resolve_host_recursive_path(&path, base_directory.as_deref())?
                } else {
                    resolve_storage_path(
                        state,
                        session,
                        &path,
                        base_directory.as_deref(),
                        StorageAccess::Write,
                        false,
                    )?
                };
                if recursive {
                    std::fs::create_dir_all(path)
                } else {
                    std::fs::create_dir(path)
                }
                .map_err(|error| operation_error("host_fs_ensure_directories", error))?;
            }
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::HostFsRename {
            source,
            destination,
            base_directory,
        } => {
            require_host(state, session)?;
            let source = resolve_storage_path(
                state,
                session,
                &source,
                base_directory.as_deref(),
                StorageAccess::Write,
                true,
            )?;
            let destination = resolve_storage_path(
                state,
                session,
                &destination,
                base_directory.as_deref(),
                StorageAccess::Write,
                false,
            )?;
            std::fs::rename(source, destination)
                .map_err(|error| operation_error("host_fs_rename", error))?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::HostFsReadBytes {
            path,
            base_directory,
        } => {
            require_host(state, session)?;
            let path = resolve_storage_path(
                state,
                session,
                &path,
                base_directory.as_deref(),
                StorageAccess::Read,
                true,
            )?;
            Ok(BrokerResponse::Bytes {
                bytes: std::fs::read(path)
                    .map_err(|error| operation_error("host_fs_read_bytes", error))?,
            })
        }
        BrokerRequest::PluginFsReadText {
            path,
            base_directory,
        } => {
            require_plugin(state, session)?;
            reject_plugin_base_directory(base_directory.as_deref())?;
            let text = plugin_fs_read_text(state, session, &path)?;
            Ok(BrokerResponse::Text { text })
        }
        BrokerRequest::PluginFsWriteText {
            path,
            contents,
            base_directory,
        } => {
            require_plugin(state, session)?;
            reject_plugin_base_directory(base_directory.as_deref())?;
            plugin_fs_write_text(state, session, &path, &contents)?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::PluginFsWriteBytes { path, bytes } => {
            plugin_fs_write_bytes(state, session, &path, &bytes)?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::PluginFsRemove { path } => {
            plugin_fs_remove(state, session, &path)?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::PluginFsReadBytes {
            path,
            base_directory,
        } => {
            require_plugin(state, session)?;
            reject_plugin_base_directory(base_directory.as_deref())?;
            let bytes = plugin_fs_read_bytes(state, session, &path)?;
            Ok(BrokerResponse::Bytes { bytes })
        }
        BrokerRequest::HostPickAndCopyIcon {
            destination_directory,
            allowed_extensions,
            title,
        } => {
            require_host(state, session)?;
            validate_icon_extensions(&allowed_extensions)?;
            let destination_directory = std::fs::canonicalize(destination_directory)
                .map_err(|error| operation_error("icon_destination", error))?;
            if !destination_directory.is_dir() {
                return Err(invalid_request("icon destination must be a directory"));
            }
            let app = app.clone();
            let picker_extensions = allowed_extensions.clone();
            let selected = tokio::task::spawn_blocking(move || {
                let extension_refs = picker_extensions
                    .iter()
                    .map(String::as_str)
                    .collect::<Vec<_>>();
                let mut dialog = app
                    .dialog()
                    .file()
                    .add_filter("Instance icon", &extension_refs);
                if let Some(title) = title {
                    dialog = dialog.set_title(title);
                }
                dialog
                    .blocking_pick_file()
                    .map(|path| path.into_path().map_err(|error| error.to_string()))
                    .transpose()
            })
            .await
            .map_err(|error| operation_error("icon_picker", error))?
            .map_err(|message| CommandError::OperationFailed {
                operation: "icon_picker",
                message,
            })?;
            let Some(selected) = selected else {
                return Ok(BrokerResponse::IconPicked { icon: None });
            };
            let selected = std::fs::canonicalize(selected)
                .map_err(|error| operation_error("icon_source", error))?;
            if !selected.is_file() || !has_allowed_extension(&selected, &allowed_extensions) {
                return Err(invalid_request("selected icon has a disallowed file type"));
            }
            let file_name = selected
                .file_name()
                .ok_or_else(|| invalid_request("selected icon has no file name"))?;
            let destination =
                canonicalize_operation_path(&destination_directory.join(file_name), false)?;
            if !destination.starts_with(&destination_directory) {
                return Err(invalid_request("icon destination escapes its directory"));
            }
            std::fs::copy(&selected, &destination)
                .map_err(|error| operation_error("icon_copy", error))?;
            let path = std::fs::canonicalize(destination)
                .map_err(|error| operation_error("icon_copy", error))?;
            let bytes =
                std::fs::read(&path).map_err(|error| operation_error("icon_read", error))?;
            Ok(BrokerResponse::IconPicked {
                icon: Some(PickedIcon { path, bytes }),
            })
        }
        BrokerRequest::Log {
            level,
            message,
            location,
        } => {
            authorize_plugin_unscoped_or_host(state, session, PermissionId::LoggingWrite)?;
            let message = location.map_or(message.clone(), |location| {
                format!("[{location}] {message}")
            });
            match level {
                LogLevel::Trace => log::trace!(target: "capability_broker", "{message}"),
                LogLevel::Debug => log::debug!(target: "capability_broker", "{message}"),
                LogLevel::Info => log::info!(target: "capability_broker", "{message}"),
                LogLevel::Warn => log::warn!(target: "capability_broker", "{message}"),
                LogLevel::Error => log::error!(target: "capability_broker", "{message}"),
            }
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::DialogAsk {
            title,
            message,
            dialog_kind,
        } => {
            require_host(state, session)?;
            let app = app.clone();
            let value = tokio::task::spawn_blocking(move || {
                let mut dialog = app
                    .dialog()
                    .message(message)
                    .kind(dialog_kind.into())
                    .buttons(MessageDialogButtons::YesNo);
                if let Some(title) = title {
                    dialog = dialog.title(title);
                }
                dialog.blocking_show()
            })
            .await
            .map_err(|error| operation_error("dialog_ask", error))?;
            Ok(BrokerResponse::Boolean { value })
        }
        BrokerRequest::DialogMessage {
            title,
            message,
            dialog_kind,
        } => {
            require_host(state, session)?;
            let app = app.clone();
            tokio::task::spawn_blocking(move || {
                let mut dialog = app.dialog().message(message).kind(dialog_kind.into());
                if let Some(title) = title {
                    dialog = dialog.title(title);
                }
                dialog.blocking_show();
            })
            .await
            .map_err(|error| operation_error("dialog_message", error))?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::OpenerReveal { path } => {
            require_host(state, session)?;
            app.opener()
                .reveal_item_in_dir(path)
                .map_err(|error| operation_error("opener_reveal", error))?;
            Ok(BrokerResponse::Unit)
        }
        BrokerRequest::HostHttpFetch { request } => {
            require_host(state, session)?;
            Ok(BrokerResponse::Http {
                response: perform_http(state, session, request).await?,
            })
        }
        BrokerRequest::HostHttpDownload {
            request,
            destination,
            base_directory,
        } => {
            require_host(state, session)?;
            let destination = resolve_storage_path(
                state,
                session,
                &destination,
                base_directory.as_deref(),
                StorageAccess::Write,
                false,
            )?;
            let response = download_http(state, session, request, destination, events).await?;
            Ok(BrokerResponse::Http { response })
        }
        BrokerRequest::HostDownloadBatch {
            entries,
            concurrency,
            label,
            cancel_id,
        } => {
            require_host(state, session)?;
            validate_host_label("download label", &label)?;
            validate_host_label("download cancellation ID", &cancel_id)?;
            let report = download_batch(
                state,
                session,
                DownloadBatchOptions {
                    generation: active_host_generation(state, session)?,
                    entries,
                    concurrency,
                    label,
                    cancel_id,
                    events,
                },
            )
            .await;
            Ok(BrokerResponse::DownloadReport {
                success: report.success,
                failed: report.failed,
                cancelled: report.cancelled,
                failures: report.failures,
            })
        }
        BrokerRequest::HostCancelDownloads { cancel_id } => {
            require_host(state, session)?;
            validate_host_label("download cancellation ID", &cancel_id)?;
            let generation = active_host_generation(state, session)?;
            Ok(BrokerResponse::Boolean {
                value: state.downloads.cancel(session, generation, &cancel_id),
            })
        }
        BrokerRequest::PluginHttpFetch { request } => {
            require_plugin(state, session)?;
            Ok(BrokerResponse::Http {
                response: perform_http(state, session, request).await?,
            })
        }
        BrokerRequest::HostProbeJavaMajor => {
            require_host(state, session)?;
            let output = app
                .shell()
                .command("java")
                .arg("-version")
                .output()
                .await
                .map_err(|error| operation_error("java_probe", error))?;
            let version_text = if output.stdout.is_empty() {
                output.stderr
            } else {
                output.stdout
            };
            let major = parse_java_major(&String::from_utf8_lossy(&version_text))
                .ok_or_else(|| invalid_request("Java version output was not recognized"))?;
            Ok(BrokerResponse::JavaMajor { major })
        }
        BrokerRequest::HostLaunchMinecraft {
            executable,
            arguments,
            cwd,
            instance_id,
        } => {
            require_host(state, session)?;
            validate_host_label("instance ID", &instance_id)?;
            let command = prepare_process_command(
                app,
                state,
                session,
                ProcessSpec {
                    executable,
                    arguments,
                    cwd: Some(cwd),
                    environment: BTreeMap::new(),
                },
            )?;
            spawn_process(app, state, session, command, events)
        }
        BrokerRequest::HostServeFile { name, file_path } => {
            require_host(state, session)?;
            validate_host_label("server name", &name)?;
            let file_path = std::fs::canonicalize(file_path)
                .map_err(|error| operation_error("server_file", error))?;
            spawn_txiki_server(
                app,
                state,
                session,
                file_path,
                ProcessArtifacts::default(),
                events,
            )
            .await
        }
        BrokerRequest::HostServeCode { name, code } => {
            require_host(state, session)?;
            validate_host_label("server name", &name)?;
            let directory = app
                .path()
                .app_data_dir()
                .map_err(|error| operation_error("server_code", error))?
                .join("capability-broker")
                .join("txiki");
            std::fs::create_dir_all(&directory)
                .map_err(|error| operation_error("server_code", error))?;
            let file_path = directory.join(format!("{}.js", random_opaque_value()?));
            let artifacts = ProcessArtifacts::owning_file(file_path.clone());
            std::fs::write(&file_path, code)
                .map_err(|error| operation_error("server_code", error))?;
            spawn_txiki_server(app, state, session, file_path, artifacts, events).await
        }
        BrokerRequest::PluginProcessSpawn { process } => {
            require_plugin(state, session)?;
            let command = prepare_process_command(app, state, session, process)?;
            spawn_process(app, state, session, command, events)
        }
        BrokerRequest::ShellExecute { shell } => {
            let command = prepare_shell_command(app, state, session, shell)?;
            execute_bound_process(app, state, session, command).await
        }
        BrokerRequest::ProcessKill { handle } => kill_process_state(state, session, &handle),
    }
}

fn grant_plugin_state(
    state: &BrokerState,
    host_session: &SessionToken,
    plugin_session: &SessionToken,
    principal: &Principal,
    prepared: PreparedGrant,
) -> Result<(), CommandError> {
    state
        .decisions
        .record_principal_grant(principal, prepared.grant.permission)
        .map_err(|error| operation_error("grant_principal_capability_history", error))?;
    let mut authorizer = lock_authorizer(state);
    authorizer.grant(host_session, plugin_session, prepared.grant)?;
    drop(authorizer);
    state
        .storage_roots
        .install(plugin_session, prepared.storage_roots);
    Ok(())
}

pub(super) async fn revoke_plugin_state(
    state: &BrokerState,
    host_session: &SessionToken,
    plugin_session: &SessionToken,
) -> Result<BrokerResponse, CommandError> {
    require_host(state, host_session)?;
    let activity = state.operations.cancel(plugin_session);
    let revocation = lock_authorizer(state).revoke_plugin(host_session, plugin_session)?;
    let process_cleanup = terminate_processes(state, &revocation.cleanup_handles);
    if let Some(activity) = activity {
        activity.wait_quiescent().await;
    }
    state.storage_roots.remove_session(plugin_session);
    state.operations.remove(plugin_session);
    process_cleanup.map_err(|message| CommandError::OperationFailed {
        operation: "revoke_plugin_processes",
        message,
    })?;
    Ok(BrokerResponse::PluginRevoked {
        already_revoked: revocation.already_revoked,
    })
}

#[derive(Clone)]
enum ActiveSession {
    Host,
    Plugin(Principal),
}

fn require_main_webview<R: Runtime>(webview: &Webview<R>) -> Result<(), CommandError> {
    if webview.label() == MAIN_WEBVIEW_LABEL {
        Ok(())
    } else {
        Err(CommandError::WrongWebview)
    }
}

fn lock_authorizer(
    state: &BrokerState,
) -> std::sync::MutexGuard<'_, super::authorizer::Authorizer> {
    state
        .authorizer
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn active_session(
    state: &BrokerState,
    session: &SessionToken,
) -> Result<ActiveSession, CommandError> {
    let authorizer = lock_authorizer(state);
    if authorizer
        .host_session(session)
        .is_some_and(|host| !host.revoked)
        && authorizer
            .active_host_session()
            .is_some_and(|host| host.token.as_str() == session.as_str())
    {
        return Ok(ActiveSession::Host);
    }
    let plugin = authorizer
        .plugin_session(session)
        .ok_or(AuthorizationError::InvalidSessionToken)?;
    if plugin.revoked {
        return Err(AuthorizationError::SessionRevoked.into());
    }
    let host_generation = authorizer
        .active_host_session()
        .ok_or(AuthorizationError::SessionRevoked)?
        .generation;
    if plugin.generation != host_generation {
        return Err(AuthorizationError::SessionRevoked.into());
    }
    Ok(ActiveSession::Plugin(plugin.principal.clone()))
}

fn require_host(state: &BrokerState, session: &SessionToken) -> Result<(), CommandError> {
    match active_session(state, session)? {
        ActiveSession::Host => Ok(()),
        ActiveSession::Plugin(_) => Err(AuthorizationError::HostSessionRequired.into()),
    }
}

fn active_host_generation(
    state: &BrokerState,
    session: &SessionToken,
) -> Result<u64, CommandError> {
    require_host(state, session)?;
    lock_authorizer(state)
        .active_host_session()
        .filter(|host| host.token.as_str() == session.as_str() && !host.revoked)
        .map(|host| host.generation)
        .ok_or_else(|| AuthorizationError::SessionRevoked.into())
}

fn require_plugin(state: &BrokerState, session: &SessionToken) -> Result<Principal, CommandError> {
    match active_session(state, session)? {
        ActiveSession::Plugin(principal) => Ok(principal),
        ActiveSession::Host => Err(AuthorizationError::PluginSessionRequired.into()),
    }
}

fn authorize_plugin_unscoped_or_host(
    state: &BrokerState,
    session: &SessionToken,
    permission: PermissionId,
) -> Result<(), CommandError> {
    match active_session(state, session)? {
        ActiveSession::Host => Ok(()),
        ActiveSession::Plugin(_) => lock_authorizer(state)
            .authorize_operation(session, permission, &Operation::Unscoped)
            .map_err(Into::into),
    }
}

fn random_session_token() -> Result<SessionToken, CommandError> {
    Ok(SessionToken::new(random_opaque_value()?))
}

fn random_resource_handle() -> Result<ResourceHandle, CommandError> {
    Ok(ResourceHandle::new(random_opaque_value()?))
}

fn random_opaque_value() -> Result<String, CommandError> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|error| CommandError::Internal {
        message: format!("operating system randomness failed: {error}"),
    })?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn is_lowercase_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

impl PermissionTargetIdentity {
    fn desktop_storage(path: PathBuf, identity: FileIdentity) -> Self {
        Self {
            kind: PermissionTargetKind::ExternalStorageRoot,
            path,
            identity_provider: PermissionTargetIdentityProvider::DesktopFilesystemV1,
            device: identity.device_string(),
            inode: identity.inode_string(),
            content_sha256: None,
        }
    }

    fn desktop_process(path: PathBuf, identity: FileIdentity, content_sha256: String) -> Self {
        Self {
            kind: PermissionTargetKind::ProcessExecutable,
            path,
            identity_provider: PermissionTargetIdentityProvider::DesktopExecutableSha256V1,
            device: identity.device_string(),
            inode: identity.inode_string(),
            content_sha256: Some(content_sha256),
        }
    }

    fn confirms_storage(&self, path: &Path, identity: FileIdentity) -> bool {
        self.identity_provider == PermissionTargetIdentityProvider::DesktopFilesystemV1
            && self.kind == PermissionTargetKind::ExternalStorageRoot
            && self.path == path
            && identity.matches_strings(&self.device, &self.inode)
            && self.content_sha256.is_none()
    }

    fn confirms_process(&self, path: &Path, identity: FileIdentity, content_sha256: &str) -> bool {
        self.identity_provider == PermissionTargetIdentityProvider::DesktopExecutableSha256V1
            && self.kind == PermissionTargetKind::ProcessExecutable
            && self.path == path
            && identity.matches_strings(&self.device, &self.inode)
            && self.content_sha256.as_deref() == Some(content_sha256)
    }
}

fn prepare_process_executable(
    requested_path: &Path,
    operation: &'static str,
) -> Result<(PathBuf, FileIdentity, String), CommandError> {
    let (canonical_path, executable, identity, content_sha256) =
        open_process_executable(requested_path, operation)?;
    let _ = identity_bound_execution_path(&canonical_path, &executable)?;
    verify_open_executable_digest(&executable, &content_sha256, operation)?;

    drop(executable);
    Ok((canonical_path, identity, content_sha256))
}

#[cfg(any(target_os = "linux", windows))]
fn open_process_executable(
    requested_path: &Path,
    operation: &'static str,
) -> Result<(PathBuf, File, FileIdentity, String), CommandError> {
    let canonical_path =
        std::fs::canonicalize(requested_path).map_err(|error| operation_error(operation, error))?;
    #[cfg(windows)]
    let mut source = {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ;

        // Omitting FILE_SHARE_WRITE and FILE_SHARE_DELETE is intentional. Windows checks sharing
        // symmetrically against existing and future opens, so this read handle prevents both
        // in-place writes and pathname replacement until CreateProcess has returned.
        std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .open(&canonical_path)
            .map_err(|error| operation_error(operation, error))?
    };
    #[cfg(not(windows))]
    let mut source =
        File::open(&canonical_path).map_err(|error| operation_error(operation, error))?;
    let metadata = source
        .metadata()
        .map_err(|error| operation_error(operation, error))?;
    if !metadata.is_file() {
        return Err(invalid_request("process executable must be a file"));
    }
    #[cfg(target_os = "linux")]
    let identity = FileIdentity::from_metadata(&metadata);
    #[cfg(windows)]
    let identity =
        FileIdentity::from_file(&source).map_err(|error| operation_error(operation, error))?;

    #[cfg(target_os = "linux")]
    let (executable, content_sha256) = snapshot_linux_executable(&mut source, operation)?;

    #[cfg(windows)]
    let (executable, content_sha256) = {
        let (content_sha256, header, header_length) =
            hash_executable_contents(&mut source, None, operation)?;
        validate_native_executable_header(&header, header_length)?;
        (source, content_sha256)
    };

    Ok((canonical_path, executable, identity, content_sha256))
}

#[cfg(not(any(target_os = "linux", windows)))]
fn open_process_executable(
    _requested_path: &Path,
    _operation: &'static str,
) -> Result<(PathBuf, File, FileIdentity, String), CommandError> {
    Err(invalid_request(
        "identity-bound process execution is unsupported on this platform",
    ))
}

#[cfg(any(target_os = "linux", windows))]
fn hash_executable_contents(
    source: &mut File,
    mut destination: Option<&mut File>,
    operation: &'static str,
) -> Result<(String, [u8; 4], usize), CommandError> {
    source
        .seek(SeekFrom::Start(0))
        .map_err(|error| operation_error(operation, error))?;
    let mut hasher = Sha256::new();
    let mut header = [0_u8; 4];
    let mut header_length = 0_usize;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let length = source
            .read(&mut buffer)
            .map_err(|error| operation_error(operation, error))?;
        if length == 0 {
            break;
        }
        let header_remaining = header.len() - header_length;
        let header_chunk = header_remaining.min(length);
        header[header_length..header_length + header_chunk]
            .copy_from_slice(&buffer[..header_chunk]);
        header_length += header_chunk;
        hasher.update(&buffer[..length]);
        if let Some(destination) = destination.as_deref_mut() {
            destination
                .write_all(&buffer[..length])
                .map_err(|error| operation_error(operation, error))?;
        }
    }
    source
        .seek(SeekFrom::Start(0))
        .map_err(|error| operation_error(operation, error))?;
    let digest = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    Ok((digest, header, header_length))
}

#[cfg(target_os = "linux")]
fn snapshot_linux_executable(
    source: &mut File,
    operation: &'static str,
) -> Result<(File, String), CommandError> {
    use rustix::fs::{fcntl_add_seals, memfd_create, MemfdFlags, SealFlags};
    use std::os::unix::fs::PermissionsExt;

    let base_flags = MemfdFlags::CLOEXEC | MemfdFlags::ALLOW_SEALING;
    let descriptor = memfd_create("kaede-plugin-executable", base_flags | MemfdFlags::EXEC)
        .or_else(|error| {
            if error == rustix::io::Errno::INVAL {
                memfd_create("kaede-plugin-executable", base_flags)
            } else {
                Err(error)
            }
        })
        .map_err(|error| operation_error(operation, error))?;
    let mut snapshot = File::from(descriptor);
    let (content_sha256, header, header_length) =
        hash_executable_contents(source, Some(&mut snapshot), operation)?;
    validate_native_executable_header(&header, header_length)?;
    snapshot
        .flush()
        .map_err(|error| operation_error(operation, error))?;
    snapshot
        .set_permissions(std::fs::Permissions::from_mode(0o500))
        .map_err(|error| operation_error(operation, error))?;
    snapshot
        .seek(SeekFrom::Start(0))
        .map_err(|error| operation_error(operation, error))?;
    fcntl_add_seals(
        &snapshot,
        SealFlags::WRITE | SealFlags::GROW | SealFlags::SHRINK | SealFlags::SEAL,
    )
    .map_err(|error| operation_error(operation, error))?;

    Ok((snapshot, content_sha256))
}

#[cfg(target_os = "linux")]
fn validate_native_executable_header(
    header: &[u8; 4],
    header_length: usize,
) -> Result<(), CommandError> {
    if header_length == header.len() && header == b"\x7fELF" {
        return Ok(());
    }
    Err(invalid_request(
        "process executable scripts must be launched through an exact interpreter rule",
    ))
}

#[cfg(windows)]
fn validate_native_executable_header(
    header: &[u8; 4],
    header_length: usize,
) -> Result<(), CommandError> {
    if header_length >= 2 && &header[..2] == b"MZ" {
        return Ok(());
    }
    Err(invalid_request(
        "process executable scripts must be launched through an exact interpreter rule",
    ))
}

#[cfg(any(target_os = "linux", windows))]
fn verify_open_executable_digest(
    executable: &File,
    expected_content_sha256: &str,
    operation: &'static str,
) -> Result<(), CommandError> {
    let mut verification = executable
        .try_clone()
        .map_err(|error| operation_error(operation, error))?;
    let (actual_content_sha256, _, _) =
        hash_executable_contents(&mut verification, None, operation)?;
    if actual_content_sha256 == expected_content_sha256 {
        Ok(())
    } else {
        Err(invalid_request(
            "process executable contents changed before process creation",
        ))
    }
}

#[cfg(not(any(target_os = "linux", windows)))]
fn verify_open_executable_digest(
    _executable: &File,
    _expected_content_sha256: &str,
    _operation: &'static str,
) -> Result<(), CommandError> {
    Err(invalid_request(
        "identity-bound process execution is unsupported on this platform",
    ))
}

fn identity_bound_execution_path(
    _canonical_path: &Path,
    executable: &File,
) -> Result<PathBuf, CommandError> {
    #[cfg(target_os = "linux")]
    {
        use rustix::fs::{fcntl_get_seals, SealFlags};
        use std::os::fd::AsRawFd;

        let descriptor_path = PathBuf::from(format!("/proc/self/fd/{}", executable.as_raw_fd()));
        std::fs::metadata(&descriptor_path)
            .map_err(|error| operation_error("process_executable_descriptor", error))?;
        let required_seals =
            SealFlags::WRITE | SealFlags::GROW | SealFlags::SHRINK | SealFlags::SEAL;
        let actual_seals = fcntl_get_seals(executable)
            .map_err(|error| operation_error("process_executable_descriptor", error))?;
        if !actual_seals.contains(required_seals) {
            return Err(invalid_request(
                "process executable snapshot is not immutable",
            ));
        }

        Ok(descriptor_path)
    }

    #[cfg(windows)]
    {
        let _ = executable;
        Ok(_canonical_path.to_path_buf())
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = (_canonical_path, executable);
        Err(invalid_request(
            "identity-bound process execution is unsupported on this platform",
        ))
    }
}

fn validate_network_scope(scope: &NetworkDescriptorScope) -> Result<(), CommandError> {
    if scope.origins.is_empty() || scope.methods.is_empty() {
        return Err(invalid_request(
            "network origins and methods must be non-empty",
        ));
    }
    for origin in &scope.origins {
        parse_exact_http_origin(origin)?;
    }
    Ok(())
}

fn prepare_permission_descriptor(
    state: &BrokerState,
    descriptor: PermissionDescriptor,
) -> Result<PreparedPermissionDescriptor, CommandError> {
    let (descriptor, target_identities) = match descriptor {
        PermissionDescriptor::Simple(permission) => {
            if !matches!(
                permission,
                PermissionId::UiBasic
                    | PermissionId::UiFormsNonCredential
                    | PermissionId::SystemShell
                    | PermissionId::EventsSubscribe
                    | PermissionId::LoggingWrite
            ) {
                return Err(invalid_request(
                    "scoped permissions require a structured descriptor",
                ));
            }
            (PermissionDescriptor::Simple(permission), Vec::new())
        }
        PermissionDescriptor::Structured(descriptor) => match descriptor {
            StructuredPermissionDescriptor::NetworkHttp { scope } => {
                validate_network_scope(&scope)?;
                (
                    PermissionDescriptor::Structured(StructuredPermissionDescriptor::NetworkHttp {
                        scope,
                    }),
                    Vec::new(),
                )
            }
            StructuredPermissionDescriptor::StorageInternalRead { scope } => {
                if scope.directory != "principal" {
                    return Err(invalid_request(
                        "internal storage directory must be principal",
                    ));
                }
                (
                    PermissionDescriptor::Structured(
                        StructuredPermissionDescriptor::StorageInternalRead { scope },
                    ),
                    Vec::new(),
                )
            }
            StructuredPermissionDescriptor::StorageInternalWrite { scope } => {
                if scope.directory != "principal" {
                    return Err(invalid_request(
                        "internal storage directory must be principal",
                    ));
                }
                (
                    PermissionDescriptor::Structured(
                        StructuredPermissionDescriptor::StorageInternalWrite { scope },
                    ),
                    Vec::new(),
                )
            }
            StructuredPermissionDescriptor::StorageExternalRead { scope } => {
                prepare_external_descriptor(state, PermissionId::StorageExternalRead, scope)?
            }
            StructuredPermissionDescriptor::StorageExternalWrite { scope } => {
                prepare_external_descriptor(state, PermissionId::StorageExternalWrite, scope)?
            }
            StructuredPermissionDescriptor::SystemProcessSpawn { scope } => {
                prepare_process_descriptor(scope)?
            }
        },
    };

    Ok(PreparedPermissionDescriptor {
        descriptor,
        target_identities,
    })
}

fn prepare_external_descriptor(
    state: &BrokerState,
    permission: PermissionId,
    scope: ExternalDescriptorScope,
) -> Result<(PermissionDescriptor, Vec<PermissionTargetIdentity>), CommandError> {
    if scope.roots.is_empty() {
        return Err(invalid_request("external storage roots must be non-empty"));
    }
    let mut canonical_roots = Vec::with_capacity(scope.roots.len());
    let mut target_identities = Vec::with_capacity(scope.roots.len());
    for root in scope.roots {
        let prepared = state
            .storage_roots
            .prepare_external(permission, &root)
            .map_err(|error| operation_error("prepare_external_storage", error))?;
        target_identities.push(PermissionTargetIdentity::desktop_storage(
            prepared.canonical_root.clone(),
            prepared.identity,
        ));
        canonical_roots.push(prepared.canonical_root.clone());
    }
    let scope = ExternalDescriptorScope {
        roots: canonical_roots,
    };
    let descriptor = match permission {
        PermissionId::StorageExternalRead => {
            StructuredPermissionDescriptor::StorageExternalRead { scope }
        }
        PermissionId::StorageExternalWrite => {
            StructuredPermissionDescriptor::StorageExternalWrite { scope }
        }
        _ => {
            return Err(invalid_request(
                "external storage preparation requires an external storage permission",
            ));
        }
    };
    Ok((
        PermissionDescriptor::Structured(descriptor),
        target_identities,
    ))
}

fn prepare_process_descriptor(
    scope: ProcessDescriptorScope,
) -> Result<(PermissionDescriptor, Vec<PermissionTargetIdentity>), CommandError> {
    if scope.executables.is_empty() {
        return Err(invalid_request("process rules must be non-empty"));
    }
    let mut executables = Vec::with_capacity(scope.executables.len());
    let mut target_identities = Vec::with_capacity(scope.executables.len());
    for executable in scope.executables {
        let (canonical_path, identity, content_sha256) =
            prepare_process_executable(&executable.path, "prepare_process")?;
        target_identities.push(PermissionTargetIdentity::desktop_process(
            canonical_path.clone(),
            identity,
            content_sha256,
        ));
        executables.push(ProcessExecutableDescriptor {
            path: canonical_path,
            arguments: executable.arguments,
        });
    }
    Ok((
        PermissionDescriptor::Structured(StructuredPermissionDescriptor::SystemProcessSpawn {
            scope: ProcessDescriptorScope { executables },
        }),
        target_identities,
    ))
}

fn require_no_target_identities(
    target_identities: &[PermissionTargetIdentity],
) -> Result<(), CommandError> {
    if target_identities.is_empty() {
        Ok(())
    } else {
        Err(invalid_request(
            "permission descriptor does not accept filesystem target identities",
        ))
    }
}

fn build_grant(
    state: &BrokerState,
    principal: &Principal,
    prepared: PreparedPermissionDescriptor,
) -> Result<PreparedGrant, CommandError> {
    let PreparedPermissionDescriptor {
        descriptor,
        target_identities,
    } = prepared;
    match descriptor {
        PermissionDescriptor::Simple(permission) => {
            require_no_target_identities(&target_identities)?;
            match permission {
                PermissionId::UiBasic
                | PermissionId::UiFormsNonCredential
                | PermissionId::EventsSubscribe
                | PermissionId::LoggingWrite => {
                    Ok(PreparedGrant::without_storage(CapabilityGrant {
                        permission,
                        scope: PermissionScope::Unscoped,
                    }))
                }
                PermissionId::SystemShell => {
                    let principal_relative_path = principal_relative_directory(principal);
                    let prepared_root = state
                        .storage_roots
                        .prepare_internal(permission, &principal_relative_path)
                        .map_err(|error| operation_error("grant_shell_storage", error))?;
                    Ok(PreparedGrant {
                        grant: CapabilityGrant {
                            permission,
                            scope: PermissionScope::Unscoped,
                        },
                        storage_roots: vec![prepared_root],
                    })
                }
                _ => Err(invalid_request(
                    "scoped permissions require a structured descriptor",
                )),
            }
        }
        PermissionDescriptor::Structured(descriptor) => match descriptor {
            StructuredPermissionDescriptor::NetworkHttp { scope } => {
                require_no_target_identities(&target_identities)?;
                validate_network_scope(&scope)?;
                let mut rules = Vec::with_capacity(scope.origins.len());
                for origin in scope.origins {
                    rules.push(HttpRule::new(
                        parse_exact_http_origin(&origin)?,
                        scope.methods.clone(),
                    ));
                }
                Ok(PreparedGrant::without_storage(CapabilityGrant {
                    permission: PermissionId::NetworkHttp,
                    scope: PermissionScope::Network(NetworkScope { rules }),
                }))
            }
            StructuredPermissionDescriptor::StorageInternalRead { scope } => {
                require_no_target_identities(&target_identities)?;
                build_internal_grant(state, principal, PermissionId::StorageInternalRead, scope)
            }
            StructuredPermissionDescriptor::StorageInternalWrite { scope } => {
                require_no_target_identities(&target_identities)?;
                build_internal_grant(state, principal, PermissionId::StorageInternalWrite, scope)
            }
            StructuredPermissionDescriptor::StorageExternalRead { scope } => build_external_grant(
                state,
                PermissionId::StorageExternalRead,
                scope,
                target_identities,
            ),
            StructuredPermissionDescriptor::StorageExternalWrite { scope } => build_external_grant(
                state,
                PermissionId::StorageExternalWrite,
                scope,
                target_identities,
            ),
            StructuredPermissionDescriptor::SystemProcessSpawn { scope } => {
                if scope.executables.is_empty() {
                    return Err(invalid_request("process rules must be non-empty"));
                }
                if scope.executables.len() != target_identities.len() {
                    return Err(invalid_request(
                        "process grant must bind every executable to an exact target identity",
                    ));
                }
                let rules = scope
                    .executables
                    .into_iter()
                    .zip(target_identities)
                    .map(|(executable, expected)| {
                        let (executable_path, identity, content_sha256) =
                            prepare_process_executable(&executable.path, "grant_process")?;
                        if !expected.confirms_process(&executable_path, identity, &content_sha256) {
                            return Err(invalid_request(
                                "process executable target changed after permission confirmation",
                            ));
                        }
                        Ok(ProcessRule::exact(
                            executable_path,
                            ProcessTargetIdentity::new(
                                identity.device_string(),
                                identity.inode_string(),
                                content_sha256,
                            ),
                            executable.arguments,
                        ))
                    })
                    .collect::<Result<Vec<_>, CommandError>>()?;
                Ok(PreparedGrant::without_storage(CapabilityGrant {
                    permission: PermissionId::SystemProcessSpawn,
                    scope: PermissionScope::Process(ProcessScope { rules }),
                }))
            }
        },
    }
}

struct PreparedGrant {
    grant: CapabilityGrant,
    storage_roots: Vec<super::PreparedStorageRoot>,
}

impl PreparedGrant {
    fn without_storage(grant: CapabilityGrant) -> Self {
        Self {
            grant,
            storage_roots: Vec::new(),
        }
    }
}

fn build_internal_grant(
    state: &BrokerState,
    principal: &Principal,
    permission: PermissionId,
    scope: InternalDescriptorScope,
) -> Result<PreparedGrant, CommandError> {
    if scope.directory != "principal" {
        return Err(invalid_request(
            "internal storage directory must be principal",
        ));
    }
    let principal_relative_path = principal_relative_directory(principal);
    let prepared_root = state
        .storage_roots
        .prepare_internal(permission, &principal_relative_path)
        .map_err(|error| operation_error("grant_internal_storage", error))?;
    Ok(PreparedGrant {
        grant: CapabilityGrant {
            permission,
            scope: PermissionScope::InternalStorage(InternalStorageScope {
                principal_directory: prepared_root.canonical_root.clone(),
            }),
        },
        storage_roots: vec![prepared_root],
    })
}

fn build_external_grant(
    state: &BrokerState,
    permission: PermissionId,
    scope: ExternalDescriptorScope,
    target_identities: Vec<PermissionTargetIdentity>,
) -> Result<PreparedGrant, CommandError> {
    if scope.roots.is_empty() {
        return Err(invalid_request("external storage roots must be non-empty"));
    }
    if scope.roots.len() != target_identities.len() {
        return Err(invalid_request(
            "external storage grant must bind every root to an exact target identity",
        ));
    }
    let prepared_roots = scope
        .roots
        .into_iter()
        .zip(target_identities)
        .map(|(root, expected)| {
            let prepared = state
                .storage_roots
                .prepare_external(permission, &root)
                .map_err(|error| operation_error("grant_external_storage", error))?;
            if !expected.confirms_storage(&prepared.canonical_root, prepared.identity) {
                return Err(invalid_request(
                    "external storage target changed after permission confirmation",
                ));
            }
            Ok(prepared)
        })
        .collect::<Result<Vec<_>, _>>()?;
    let canonical_roots = prepared_roots
        .iter()
        .map(|root| root.canonical_root.clone())
        .collect();
    Ok(PreparedGrant {
        grant: CapabilityGrant {
            permission,
            scope: PermissionScope::ExternalStorage(ExternalStorageScope { canonical_roots }),
        },
        storage_roots: prepared_roots,
    })
}

fn parse_exact_http_origin(origin: &str) -> Result<HttpOrigin, CommandError> {
    let parsed = reqwest::Url::parse(origin).map_err(|_| invalid_request("invalid HTTP origin"))?;
    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.origin().ascii_serialization() != origin
    {
        return Err(invalid_request("HTTP origin must be exact and canonical"));
    }
    HttpOrigin::from_url(origin).map_err(Into::into)
}

fn principal_relative_directory(principal: &Principal) -> PathBuf {
    let mut path = PathBuf::new();
    append_exact_path_field(&mut path, "repository", &principal.repository_origin);
    append_exact_path_field(&mut path, "plugin", &principal.plugin_id);
    append_exact_path_field(&mut path, "version", &principal.version);
    append_exact_path_field(&mut path, "artifact", &principal.artifact_sha256);
    path
}

fn append_exact_path_field(path: &mut PathBuf, label: &str, value: &str) {
    path.push(label);
    path.push(value.len().to_string());
    let encoded = value
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    for chunk in encoded.as_bytes().chunks(64) {
        path.push(String::from_utf8_lossy(chunk).as_ref());
    }
}

#[derive(Clone, Copy)]
enum StorageAccess {
    Read,
    Write,
}

fn plugin_fs_write_bytes(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    bytes: &[u8],
) -> Result<(), CommandError> {
    plugin_fs_write(state, session, requested, bytes, "fs_write_bytes")
}

fn plugin_fs_write_text(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    contents: &str,
) -> Result<(), CommandError> {
    plugin_fs_write(
        state,
        session,
        requested,
        contents.as_bytes(),
        "fs_write_text",
    )
}

fn plugin_fs_write(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    bytes: &[u8],
    operation: &'static str,
) -> Result<(), CommandError> {
    require_plugin(state, session)?;
    let target =
        resolve_plugin_storage_target(state, session, requested, StorageAccess::Write, false)?;
    let mut options = CapabilityOpenOptions::new();
    options.write(true).create(true);
    let mut file = open_plugin_storage_content_file(&target, options, operation)?;
    file.set_len(0)
        .map_err(|error| operation_error(operation, error))?;
    file.write_all(bytes)
        .map_err(|error| operation_error(operation, error))
}

fn plugin_fs_read_text(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
) -> Result<String, CommandError> {
    let mut file = open_plugin_storage_file_for_read(state, session, requested, "fs_read_text")?;
    let mut text = String::new();
    file.read_to_string(&mut text)
        .map_err(|error| operation_error("fs_read_text", error))?;
    Ok(text)
}

fn plugin_fs_read_bytes(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
) -> Result<Vec<u8>, CommandError> {
    let mut file = open_plugin_storage_file_for_read(state, session, requested, "fs_read_bytes")?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| operation_error("fs_read_bytes", error))?;
    Ok(bytes)
}

fn open_plugin_storage_file_for_read(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    operation: &'static str,
) -> Result<CapabilityFile, CommandError> {
    require_plugin(state, session)?;
    let target =
        resolve_plugin_storage_target(state, session, requested, StorageAccess::Read, true)?;
    let mut options = CapabilityOpenOptions::new();
    options.read(true);
    open_plugin_storage_content_file(&target, options, operation)
}

fn open_plugin_storage_content_file(
    target: &super::StorageTarget,
    options: CapabilityOpenOptions,
    operation: &'static str,
) -> Result<CapabilityFile, CommandError> {
    #[cfg(unix)]
    let options = {
        use cap_fs_ext::OpenOptionsSyncExt;

        // A plugin-controlled FIFO or device must not retain the operation
        // lease while the OS waits for a peer. The held object is validated
        // as a regular file before any content read, truncate, or write.
        let mut options = options;
        options.nonblock(true);
        options
    };

    let file = target
        .directory
        .open_with(&target.relative_path, &options)
        .map_err(|error| operation_error(operation, error))?;
    // `cap_std::fs::File::metadata` constructs metadata from this held file
    // handle. `cap_fs_ext::MetadataExt::nlink` therefore uses `fstat` on Unix
    // and BY_HANDLE_FILE_INFORMATION through `winx` on stable Windows.
    let metadata = file
        .metadata()
        .map_err(|error| operation_error(operation, error))?;
    if !metadata.is_file() {
        return Err(CommandError::Unauthorized {
            message: "plugin storage content operations require a regular file".to_owned(),
        });
    }
    if metadata.nlink() != 1 {
        return Err(CommandError::Unauthorized {
            message: "plugin storage does not permit multiply-linked files".to_owned(),
        });
    }
    Ok(file)
}

fn plugin_fs_remove(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
) -> Result<(), CommandError> {
    require_plugin(state, session)?;
    let target =
        resolve_plugin_storage_target(state, session, requested, StorageAccess::Write, true)?;
    let metadata = target
        .directory
        .symlink_metadata(&target.relative_path)
        .map_err(|error| operation_error("fs_remove_metadata", error))?;
    let _held_file = if metadata.is_file() {
        let file = open_regular_file_for_remove(&target)?;
        validate_plugin_storage_remove_file(&file)?;
        Some(file)
    } else {
        None
    };
    if metadata.is_dir() {
        target
            .directory
            .remove_dir(&target.relative_path)
            .map_err(|error| operation_error("fs_remove", error))
    } else {
        target
            .directory
            .remove_file_or_symlink(&target.relative_path)
            .map_err(|error| operation_error("fs_remove", error))
    }
}

fn validate_plugin_storage_remove_file(file: &CapabilityFile) -> Result<(), CommandError> {
    let metadata = file
        .metadata()
        .map_err(|error| operation_error("fs_remove_metadata", error))?;
    if metadata.is_file() && metadata.nlink() != 1 {
        return Err(CommandError::Unauthorized {
            message: "plugin storage does not permit multiply-linked files".to_owned(),
        });
    }
    Ok(())
}

fn open_regular_file_for_remove(
    target: &super::StorageTarget,
) -> Result<CapabilityFile, CommandError> {
    #[cfg(unix)]
    {
        use cap_fs_ext::OpenOptionsSyncExt;

        // `O_NONBLOCK` prevents a regular-file-to-FIFO race from hanging the
        // operation lease. Try read access first, then write access so normal
        // unlink semantics still work for mode-0200 single-link files. If
        // neither content access is available, removal fails closed.
        let mut read_options = CapabilityOpenOptions::new();
        read_options.read(true).nonblock(true);
        match target
            .directory
            .open_with(&target.relative_path, &read_options)
        {
            Ok(file) => Ok(file),
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                let mut write_options = CapabilityOpenOptions::new();
                write_options.write(true).nonblock(true);
                target
                    .directory
                    .open_with(&target.relative_path, &write_options)
                    .map_err(|error| operation_error("fs_remove_metadata", error))
            }
            Err(error) => Err(operation_error("fs_remove_metadata", error)),
        }
    }

    #[cfg(windows)]
    {
        use cap_std::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_BACKUP_SEMANTICS;

        // A zero-access CreateFile handle is sufficient for by-handle link
        // metadata and does not require content-read permission.
        let mut options = CapabilityOpenOptions::new();
        options
            .access_mode(0)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS);
        target
            .directory
            .open_with(&target.relative_path, &options)
            .map_err(|error| operation_error("fs_remove_metadata", error))
    }

    #[cfg(not(any(unix, windows)))]
    {
        target
            .directory
            .open(&target.relative_path)
            .map_err(|error| operation_error("fs_remove_metadata", error))
    }
}

fn reject_plugin_base_directory(base_directory: Option<&Path>) -> Result<(), CommandError> {
    if base_directory.is_some() {
        Err(invalid_request(
            "plugin storage requests cannot provide a host base directory",
        ))
    } else {
        Ok(())
    }
}

fn resolve_plugin_storage_target(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    access: StorageAccess,
    must_exist: bool,
) -> Result<super::StorageTarget, CommandError> {
    require_plugin(state, session)?;
    let target = if requested.is_absolute() {
        let permission = match access {
            StorageAccess::Read => PermissionId::StorageExternalRead,
            StorageAccess::Write => PermissionId::StorageExternalWrite,
        };
        let canonical_path = canonicalize_operation_path(requested, must_exist)?;
        state
            .storage_roots
            .resolve(session, permission, &canonical_path)
            .map_err(|error| operation_error("resolve_storage_root", error))?
    } else {
        validate_relative_plugin_path(requested)?;
        let permission = match access {
            StorageAccess::Read => PermissionId::StorageInternalRead,
            StorageAccess::Write => PermissionId::StorageInternalWrite,
        };
        state
            .storage_roots
            .resolve_internal(session, permission, requested)
            .map_err(|error| operation_error("resolve_storage_root", error))?
    };
    reauthorize_plugin_storage_target(state, session, &target)?;
    Ok(target)
}

fn reauthorize_plugin_storage_target(
    state: &BrokerState,
    session: &SessionToken,
    target: &super::StorageTarget,
) -> Result<(), CommandError> {
    require_plugin(state, session)?;
    let operation = if target.internal {
        Operation::InternalStorage {
            canonical_path: target.canonical_path.clone(),
        }
    } else {
        Operation::ExternalStorage {
            canonical_path: target.canonical_path.clone(),
        }
    };
    lock_authorizer(state).authorize_operation(session, target.permission, &operation)?;
    Ok(())
}

fn resolve_storage_path(
    state: &BrokerState,
    session: &SessionToken,
    requested: &Path,
    base_directory: Option<&Path>,
    access: StorageAccess,
    must_exist: bool,
) -> Result<PathBuf, CommandError> {
    match active_session(state, session)? {
        ActiveSession::Host => resolve_host_path(requested, base_directory, must_exist),
        ActiveSession::Plugin(_) => {
            if base_directory.is_some() {
                return Err(invalid_request(
                    "plugin storage requests cannot provide a host base directory",
                ));
            }
            if !requested.is_absolute() {
                return Err(invalid_request(
                    "internal plugin storage must be resolved through its retained capability",
                ));
            }
            let canonical_path = canonicalize_operation_path(requested, must_exist)?;
            state
                .storage_roots
                .ensure_external_path_is_delegable(&canonical_path)
                .map_err(|error| operation_error("resolve_storage_root", error))?;
            let permission = match access {
                StorageAccess::Read => PermissionId::StorageExternalRead,
                StorageAccess::Write => PermissionId::StorageExternalWrite,
            };
            let operation = Operation::ExternalStorage {
                canonical_path: canonical_path.clone(),
            };
            lock_authorizer(state).authorize_operation(session, permission, &operation)?;
            Ok(canonical_path)
        }
    }
}

fn resolve_host_path(
    requested: &Path,
    base_directory: Option<&Path>,
    must_exist: bool,
) -> Result<PathBuf, CommandError> {
    let (candidate, canonical_base) = if let Some(base) = base_directory {
        if requested.is_absolute() {
            return Err(invalid_request(
                "path must be relative when a host base directory is provided",
            ));
        }
        validate_relative_plugin_path(requested)?;
        let canonical_base = std::fs::canonicalize(base)
            .map_err(|error| operation_error("host_base_directory", error))?;
        (canonical_base.join(requested), Some(canonical_base))
    } else if requested.is_absolute() {
        (requested.to_path_buf(), None)
    } else {
        return Err(invalid_request(
            "host path must be absolute without a base directory",
        ));
    };
    let resolved = canonicalize_operation_path(&candidate, must_exist)?;
    if canonical_base
        .as_ref()
        .is_some_and(|base| !resolved.starts_with(base))
    {
        return Err(invalid_request("path escapes its host base"));
    }
    Ok(resolved)
}

fn resolve_host_recursive_path(
    requested: &Path,
    base_directory: Option<&Path>,
) -> Result<PathBuf, CommandError> {
    let (candidate, canonical_base) = if let Some(base) = base_directory {
        if requested.is_absolute() {
            return Err(invalid_request(
                "path must be relative when a host base directory is provided",
            ));
        }
        validate_relative_plugin_path(requested)?;
        let canonical_base = std::fs::canonicalize(base)
            .map_err(|error| operation_error("host_base_directory", error))?;
        (canonical_base.join(requested), Some(canonical_base))
    } else if requested.is_absolute() {
        if requested
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
        {
            return Err(invalid_request(
                "recursive directory path contains traversal",
            ));
        }
        (requested.to_path_buf(), None)
    } else {
        return Err(invalid_request(
            "host path must be absolute without a base directory",
        ));
    };

    let resolved = canonicalize_with_missing_descendants(&candidate)?;
    if canonical_base
        .as_ref()
        .is_some_and(|base| !resolved.starts_with(base))
    {
        return Err(invalid_request("recursive directory escapes its host base"));
    }
    Ok(resolved)
}

fn canonicalize_operation_path(path: &Path, must_exist: bool) -> Result<PathBuf, CommandError> {
    if must_exist {
        return std::fs::canonicalize(path)
            .map_err(|error| operation_error("canonicalize_path", error));
    }
    canonicalize_with_missing_descendants(path)
}

fn canonicalize_with_missing_descendants(path: &Path) -> Result<PathBuf, CommandError> {
    let mut existing = path;
    let mut suffix = Vec::new();
    loop {
        match std::fs::symlink_metadata(existing) {
            Ok(_) => break,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let name = existing
                    .file_name()
                    .ok_or_else(|| invalid_request("path has no existing ancestor"))?;
                suffix.push(name.to_os_string());
                existing = existing
                    .parent()
                    .ok_or_else(|| invalid_request("path has no existing ancestor"))?;
            }
            Err(error) => return Err(operation_error("canonicalize_path_ancestor", error)),
        }
    }
    let mut resolved = std::fs::canonicalize(existing)
        .map_err(|error| operation_error("canonicalize_path_ancestor", error))?;
    for component in suffix.into_iter().rev() {
        resolved.push(component);
    }
    Ok(resolved)
}

fn validate_relative_plugin_path(path: &Path) -> Result<(), CommandError> {
    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(invalid_request(
            "relative storage path contains traversal or a platform prefix",
        ));
    }
    Ok(())
}

fn read_directory_response(path: PathBuf) -> Result<BrokerResponse, CommandError> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path).map_err(|error| operation_error("fs_read_dir", error))? {
        let entry = entry.map_err(|error| operation_error("fs_read_dir", error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| operation_error("fs_read_dir", error))?;
        entries.push(DirectoryEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            is_directory: file_type.is_dir(),
            is_file: file_type.is_file(),
            is_symlink: file_type.is_symlink(),
        });
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(BrokerResponse::DirectoryEntries { entries })
}

fn validate_icon_extensions(extensions: &[String]) -> Result<(), CommandError> {
    if extensions.is_empty()
        || extensions.iter().any(|extension| {
            extension.is_empty()
                || extension.len() > 16
                || !extension.bytes().all(|byte| byte.is_ascii_alphanumeric())
        })
    {
        return Err(invalid_request(
            "icon extensions must be non-empty ASCII alphanumeric values",
        ));
    }
    Ok(())
}

fn has_allowed_extension(path: &Path, extensions: &[String]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extensions
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
}

fn validate_host_label(label: &str, value: &str) -> Result<(), CommandError> {
    if value.is_empty() || value.len() > 256 || value.chars().any(char::is_control) {
        Err(invalid_request(format!("{label} is invalid")))
    } else {
        Ok(())
    }
}

fn parse_java_major(output: &str) -> Option<u32> {
    let quoted = output.split('"').nth(1)?;
    let mut parts = quoted.split('.');
    let first = parts.next()?.parse::<u32>().ok()?;
    if first == 1 {
        parts.next()?.parse().ok()
    } else {
        Some(first)
    }
}

async fn spawn_txiki_server<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    file_path: PathBuf,
    artifacts: ProcessArtifacts,
    mut events: Option<Channel<BrokerEvent>>,
) -> Result<BrokerResponse, CommandError> {
    let readiness_nonce = random_opaque_value()?;
    let wrapper_path = create_txiki_server_wrapper(app, &file_path, &readiness_nonce)?;
    let artifacts = artifacts.and_owning_file(wrapper_path.clone());
    let command = app
        .shell()
        .sidecar("txiki-server")
        .map_err(|error| operation_error("txiki_sidecar", error))?
        .args(txiki_server_arguments(&wrapper_path))
        .set_raw_out(true);
    let (mut receiver, handle, pid) = register_process(
        state,
        session,
        ProcessCommand::unbound(command),
        artifacts,
        events.clone(),
    )?;
    let mut readiness_output = Vec::new();
    let readiness = async {
        loop {
            match receiver.recv().await {
                Some(CommandEvent::Stdout(bytes)) => {
                    append_txiki_readiness_output(&mut readiness_output, &bytes);
                    send_broker_event(
                        &mut events,
                        BrokerEvent::Stdout {
                            handle: handle.clone(),
                            bytes,
                        },
                    );
                    if let Some(port) = parse_txiki_ready_port(&readiness_output, &readiness_nonce)
                    {
                        return Ok(port);
                    }
                }
                Some(CommandEvent::Stderr(bytes)) => {
                    send_broker_event(
                        &mut events,
                        BrokerEvent::Stderr {
                            handle: handle.clone(),
                            bytes,
                        },
                    );
                }
                Some(CommandEvent::Error(message)) => {
                    send_broker_event(
                        &mut events,
                        BrokerEvent::Error {
                            handle: handle.clone(),
                            message,
                        },
                    );
                }
                Some(CommandEvent::Terminated(payload)) => {
                    let message = format!(
                        "txiki sidecar terminated before readiness (code {:?}, signal {:?})",
                        payload.code, payload.signal
                    );
                    finish_process_resource(
                        state,
                        &handle,
                        ProcessStreamEnd::Terminated {
                            code: payload.code,
                            signal: payload.signal,
                        },
                        events.take(),
                    )
                    .map_err(|error| CommandError::OperationFailed {
                        operation: "server_ready_cleanup",
                        message: error,
                    })?;

                    return Err(CommandError::OperationFailed {
                        operation: "server_ready",
                        message,
                    });
                }
                None => {
                    let message = "txiki sidecar event stream ended before readiness".to_owned();
                    finish_process_resource(
                        state,
                        &handle,
                        ProcessStreamEnd::ClosedWithoutTermination {
                            message: message.clone(),
                        },
                        events.take(),
                    )
                    .map_err(|error| CommandError::OperationFailed {
                        operation: "server_ready_cleanup",
                        message: error,
                    })?;

                    return Err(CommandError::OperationFailed {
                        operation: "server_ready",
                        message,
                    });
                }
                Some(_) => {}
            }
        }
    };
    let port = match tokio::time::timeout(std::time::Duration::from_secs(10), readiness).await {
        Ok(result) => result?,
        Err(_) => {
            kill_process_state(state, session, &handle).map_err(|error| {
                CommandError::OperationFailed {
                    operation: "server_ready_cleanup",
                    message: command_error_message(&error),
                }
            })?;

            return Err(CommandError::OperationFailed {
                operation: "server_ready",
                message: "txiki sidecar did not report readiness within 10 seconds".to_owned(),
            });
        }
    };
    let cleanup_app = app.clone();
    let cleanup_handle = handle.clone();
    forward_events(
        receiver,
        handle.clone(),
        events,
        move |stream_end, channel| {
            let state = cleanup_app.state::<BrokerState>();
            finish_process_resource(&state, &cleanup_handle, stream_end, channel)
        },
    );

    Ok(BrokerResponse::ServerSpawned { handle, pid, port })
}

fn create_txiki_server_wrapper<R: Runtime>(
    app: &AppHandle<R>,
    target_path: &Path,
    readiness_nonce: &str,
) -> Result<PathBuf, CommandError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| operation_error("txiki_wrapper", error))?
        .join("capability-broker")
        .join("txiki");
    std::fs::create_dir_all(&directory).map_err(|error| operation_error("txiki_wrapper", error))?;
    let wrapper_path = directory.join(format!("{}.wrapper.js", random_opaque_value()?));
    let wrapper = txiki_server_wrapper(target_path, readiness_nonce)?;
    if let Err(error) = std::fs::write(&wrapper_path, wrapper) {
        let _ = std::fs::remove_file(&wrapper_path);
        return Err(operation_error("txiki_wrapper", error));
    }
    Ok(wrapper_path)
}

fn txiki_server_wrapper(target_path: &Path, readiness_nonce: &str) -> Result<String, CommandError> {
    let target_specifier = serde_json::to_string(&target_path.to_string_lossy())
        .map_err(|error| operation_error("txiki_wrapper", error))?;
    let readiness_marker = serde_json::to_string(&txiki_readiness_marker(readiness_nonce))
        .map_err(|error| operation_error("txiki_wrapper", error))?;
    Ok(format!(
        "const announce = console.log.bind(console);\n\
         const serve = tjs.serve.bind(tjs);\n\
         const module = await import({target_specifier});\n\
         const handler = module.default?.fetch;\n\
         if (typeof handler !== 'function') {{\n\
           throw new TypeError('Module must default export an object with a fetch method');\n\
         }}\n\
         const server = serve({{\n\
           fetch: handler,\n\
           port: 0,\n\
           websocket: module.default.websocket,\n\
         }});\n\
         announce({readiness_marker} + server.port);\n"
    ))
}

fn txiki_server_arguments(wrapper_path: &Path) -> [String; 2] {
    [
        "run".to_owned(),
        wrapper_path.to_string_lossy().into_owned(),
    ]
}

fn txiki_readiness_marker(readiness_nonce: &str) -> String {
    format!("KAEDE_TXIKI_READY_{readiness_nonce}:")
}

fn parse_txiki_ready_port(output: &[u8], readiness_nonce: &str) -> Option<u16> {
    let marker = txiki_readiness_marker(readiness_nonce);

    String::from_utf8_lossy(output).lines().find_map(|line| {
        line.strip_prefix(&marker)
            .and_then(|value| value.parse::<u16>().ok())
            .filter(|port| *port != 0)
    })
}

fn append_txiki_readiness_output(output: &mut Vec<u8>, bytes: &[u8]) {
    const MAX_READINESS_OUTPUT: usize = 4 * 1024;

    output.extend_from_slice(bytes);
    if output.len() > MAX_READINESS_OUTPUT {
        output.drain(..output.len() - MAX_READINESS_OUTPUT);
    }
}

fn prepare_process_command<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    process: ProcessSpec,
) -> Result<ProcessCommand, CommandError> {
    let ProcessSpec {
        executable,
        arguments,
        cwd,
        environment,
    } = process;
    let (execution_path, original_program, executable_guard, cwd, environment, clear_environment) =
        match active_session(state, session)? {
            ActiveSession::Host => {
                validate_environment_keys(&environment)?;
                (executable, None, None, cwd, environment, false)
            }
            ActiveSession::Plugin(principal) => {
                validate_plugin_process_options(cwd.as_deref(), &environment)?;
                let (executable, executable_guard, target_identity, content_sha256) =
                    open_process_executable(&executable, "process_executable")?;
                lock_authorizer(state).authorize_operation(
                    session,
                    PermissionId::SystemProcessSpawn,
                    &Operation::Process {
                        executable: executable.clone(),
                        target_identity: ProcessTargetIdentity::new(
                            target_identity.device_string(),
                            target_identity.inode_string(),
                            content_sha256.clone(),
                        ),
                        arguments: arguments.clone(),
                    },
                )?;
                verify_open_executable_digest(
                    &executable_guard,
                    &content_sha256,
                    "process_executable_verify",
                )?;
                let execution_path = identity_bound_execution_path(&executable, &executable_guard)?;
                let cwd = prepare_plugin_process_cwd(state, &principal)?;
                (
                    execution_path,
                    Some(executable),
                    Some(executable_guard),
                    Some(cwd),
                    BTreeMap::new(),
                    true,
                )
            }
        };

    let mut command = app.shell().command(execution_path).args(arguments);
    if clear_environment {
        command = command.env_clear();
    }
    if let Some(cwd) = cwd {
        command = command.current_dir(cwd);
    }
    if !environment.is_empty() {
        command = command.envs(environment);
    }
    let command = command.set_raw_out(true);

    Ok(match (executable_guard, original_program) {
        (Some(executable_guard), Some(original_program)) => {
            ProcessCommand::identity_bound(command, executable_guard, original_program)
        }
        (None, None) => ProcessCommand::unbound(command),
        _ => {
            return Err(CommandError::Internal {
                message: "process executable identity binding was incomplete".to_owned(),
            });
        }
    })
}

fn prepare_plugin_process_cwd(
    state: &BrokerState,
    principal: &Principal,
) -> Result<PathBuf, CommandError> {
    let principal_relative_path = principal_relative_directory(principal);
    state
        .storage_roots
        .trusted_plugin_data
        .create_dir_all(&principal_relative_path)
        .map_err(|error| operation_error("process_cwd", error))?;

    let expected = state.storage_roots.principal_path(&principal_relative_path);
    let canonical =
        std::fs::canonicalize(&expected).map_err(|error| operation_error("process_cwd", error))?;
    if canonical != expected {
        return Err(invalid_request(
            "plugin process cwd must be the exact principal internal storage root",
        ));
    }
    Ok(canonical)
}

fn validate_plugin_process_options(
    cwd: Option<&Path>,
    environment: &BTreeMap<String, String>,
) -> Result<(), CommandError> {
    if cwd.is_some() || !environment.is_empty() {
        return Err(invalid_request(
            "plugin process grants authorize exact executable and arguments only; cwd and environment must be omitted",
        ));
    }
    Ok(())
}

fn prepare_shell_command<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    shell: ShellSpec,
) -> Result<ProcessCommand, CommandError> {
    let principal = match active_session(state, session)? {
        ActiveSession::Host => {
            return Err(invalid_request(
                "host generic shell is intentionally not brokered",
            ));
        }
        ActiveSession::Plugin(principal) => principal,
    };
    lock_authorizer(state).authorize_operation(
        session,
        PermissionId::SystemShell,
        &Operation::Unscoped,
    )?;
    let internal_root = prepare_plugin_process_cwd(state, &principal)?;
    let environment = canonicalize_plugin_environment(&internal_root, shell.environment)?;
    let cwd = shell
        .cwd
        .map(|cwd| canonicalize_plugin_process_path(&internal_root, &cwd))
        .transpose()?
        .unwrap_or(internal_root);

    #[cfg(windows)]
    let (program, arguments) = (
        PathBuf::from("cmd.exe"),
        vec![
            "/D".to_owned(),
            "/S".to_owned(),
            "/C".to_owned(),
            shell.script,
        ],
    );
    #[cfg(not(windows))]
    let (program, arguments) = (
        PathBuf::from("/bin/sh"),
        vec!["-c".to_owned(), shell.script],
    );

    let mut command = app
        .shell()
        .command(program)
        .args(arguments)
        .env_clear()
        .current_dir(cwd);
    if !environment.is_empty() {
        command = command.envs(environment);
    }
    Ok(ProcessCommand::unbound(command.set_raw_out(true)))
}

fn canonicalize_plugin_process_path(
    internal_root: &Path,
    requested: &Path,
) -> Result<PathBuf, CommandError> {
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        validate_relative_plugin_path(requested)?;
        internal_root.join(requested)
    };
    let canonical = std::fs::canonicalize(candidate)
        .map_err(|error| operation_error("plugin_process_path", error))?;
    if !canonical.starts_with(internal_root) {
        return Err(invalid_request(
            "plugin process path escapes its internal storage root",
        ));
    }
    Ok(canonical)
}

fn canonicalize_plugin_environment(
    internal_root: &Path,
    environment: BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>, CommandError> {
    validate_environment_keys(&environment)?;
    environment
        .into_iter()
        .map(|(key, value)| {
            let path = canonicalize_plugin_process_path(internal_root, Path::new(&value))?;
            Ok((key, path.to_string_lossy().into_owned()))
        })
        .collect()
}

fn validate_environment_keys(environment: &BTreeMap<String, String>) -> Result<(), CommandError> {
    if environment
        .keys()
        .any(|key| key.is_empty() || key.contains(['=', '\0']))
        || environment.values().any(|value| value.contains('\0'))
    {
        return Err(invalid_request(
            "process environment contains an invalid key or value",
        ));
    }
    Ok(())
}

fn spawn_process<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    command: ProcessCommand,
    events: Option<Channel<BrokerEvent>>,
) -> Result<BrokerResponse, CommandError> {
    spawn_process_with_artifacts(
        app,
        state,
        session,
        command,
        ProcessArtifacts::default(),
        events,
    )
}

fn spawn_process_with_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    command: ProcessCommand,
    artifacts: ProcessArtifacts,
    events: Option<Channel<BrokerEvent>>,
) -> Result<BrokerResponse, CommandError> {
    let (receiver, handle, pid) =
        register_process(state, session, command, artifacts, events.clone())?;
    let cleanup_app = app.clone();
    let cleanup_handle = handle.clone();
    forward_events(
        receiver,
        handle.clone(),
        events,
        move |stream_end, channel| {
            let state = cleanup_app.state::<BrokerState>();
            finish_process_resource(&state, &cleanup_handle, stream_end, channel)
        },
    );
    Ok(BrokerResponse::ProcessSpawned { handle, pid })
}

pub(super) fn finish_process_resource(
    state: &BrokerState,
    handle: &ResourceHandle,
    stream_end: ProcessStreamEnd,
    mut channel: Option<Channel<BrokerEvent>>,
) -> Result<(), String> {
    let _finalization = state
        .process_finalization
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    match stream_end {
        ProcessStreamEnd::Terminated { code, signal } => {
            state.processes.remove_finished(handle);
            lock_authorizer(state).release_resource(handle);
            send_broker_event(
                &mut channel,
                BrokerEvent::Terminated {
                    handle: handle.clone(),
                    code,
                    signal,
                },
            );
            Ok(())
        }
        ProcessStreamEnd::ClosedWithoutTermination { message } => {
            match state
                .processes
                .finish_failed_stream(handle, message.clone())
            {
                Ok(()) => {
                    lock_authorizer(state).release_resource(handle);
                    send_broker_event(
                        &mut channel,
                        BrokerEvent::Failed {
                            handle: handle.clone(),
                            message,
                        },
                    );
                    Ok(())
                }
                Err(cleanup_error) => {
                    send_broker_event(
                        &mut channel,
                        BrokerEvent::Error {
                            handle: handle.clone(),
                            message: format!(
                                "{message}; automatic cleanup failed and the process was retained for retry: {cleanup_error}"
                            ),
                        },
                    );
                    Err(cleanup_error)
                }
            }
        }
    }
}

pub(super) fn kill_process_state(
    state: &BrokerState,
    session: &SessionToken,
    handle: &ResourceHandle,
) -> Result<BrokerResponse, CommandError> {
    authorize_resource_owner(state, session, handle)?;
    let _finalization = state
        .process_finalization
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let terminal_failure =
        state
            .processes
            .kill(handle)
            .map_err(|message| CommandError::OperationFailed {
                operation: "process_kill",
                message,
            })?;
    lock_authorizer(state).release_resource(handle);
    if let Some(terminal_failure) = terminal_failure {
        terminal_failure.send();
    }
    Ok(BrokerResponse::Unit)
}

fn register_process(
    state: &BrokerState,
    session: &SessionToken,
    command: ProcessCommand,
    artifacts: ProcessArtifacts,
    events: Option<Channel<BrokerEvent>>,
) -> Result<
    (
        tauri::async_runtime::Receiver<tauri_plugin_shellx::process::CommandEvent>,
        ResourceHandle,
        u32,
    ),
    CommandError,
> {
    let handle = random_resource_handle()?;
    let (receiver, pid) = register_process_resource(state, session, &handle, || {
        state
            .processes
            .spawn_command(handle.clone(), command, artifacts, events)
    })
    .map_err(|error| match error {
        ProcessRegistrationError::Authorization(error) => error.into(),
        ProcessRegistrationError::Spawn(message) => CommandError::OperationFailed {
            operation: "process_spawn",
            message,
        },
    })?;
    Ok((receiver, handle, pid))
}

async fn execute_bound_process<R: Runtime>(
    _app: &AppHandle<R>,
    state: &BrokerState,
    session: &SessionToken,
    command: ProcessCommand,
) -> Result<BrokerResponse, CommandError> {
    use tauri_plugin_shellx::process::CommandEvent;

    let (mut receiver, handle, _pid) =
        register_process(state, session, command, ProcessArtifacts::default(), None)?;
    let mut code = None;
    let mut signal = None;
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut process_error = None;
    let mut terminated = false;
    while let Some(event) = receiver.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => stdout.extend(bytes),
            CommandEvent::Stderr(bytes) => stderr.extend(bytes),
            CommandEvent::Terminated(payload) => {
                code = payload.code;
                signal = payload.signal;
                terminated = true;
                break;
            }
            CommandEvent::Error(message) => {
                process_error.get_or_insert(message);
            }
            _ => {}
        }
    }
    if !terminated {
        let message = process_error.unwrap_or_else(|| {
            "process event stream ended before termination was observed".to_owned()
        });
        let message = match finish_process_resource(
            state,
            &handle,
            ProcessStreamEnd::ClosedWithoutTermination {
                message: message.clone(),
            },
            None,
        ) {
            Ok(()) => message,
            Err(cleanup_error) => format!(
                "{message}; automatic cleanup failed and the process was retained for retry: {cleanup_error}"
            ),
        };
        active_session(state, session)?;
        return Err(CommandError::OperationFailed {
            operation: "process_execute",
            message,
        });
    }
    finish_process_resource(
        state,
        &handle,
        ProcessStreamEnd::Terminated { code, signal },
        None,
    )
    .map_err(|message| CommandError::OperationFailed {
        operation: "process_execute_cleanup",
        message,
    })?;
    active_session(state, session)?;
    if let Some(message) = process_error {
        return Err(CommandError::OperationFailed {
            operation: "process_execute",
            message,
        });
    }
    Ok(BrokerResponse::ProcessOutput {
        code,
        stdout,
        stderr,
    })
}

fn authorize_resource_owner(
    state: &BrokerState,
    session: &SessionToken,
    handle: &ResourceHandle,
) -> Result<(), CommandError> {
    if lock_authorizer(state)
        .list_resource_handles(session)?
        .iter()
        .any(|owned| owned.as_str() == handle.as_str())
    {
        Ok(())
    } else {
        Err(AuthorizationError::ResourceOwnedByAnotherSession.into())
    }
}

async fn perform_http(
    state: &BrokerState,
    session: &SessionToken,
    request: HttpRequest,
) -> Result<HttpResponse, CommandError> {
    let pending = send_http(state, session, request).await?;
    let PendingHttpResponse {
        response,
        url,
        method,
        plugin,
        redirected,
    } = pending;
    let response = collect_http_response(response, url.clone(), redirected).await?;
    reauthorize_http(state, session, &url, &method, plugin)?;
    Ok(response)
}

struct PendingHttpResponse {
    response: reqwest::Response,
    url: reqwest::Url,
    method: HttpMethod,
    plugin: bool,
    redirected: bool,
}

async fn send_http(
    state: &BrokerState,
    session: &SessionToken,
    request: HttpRequest,
) -> Result<PendingHttpResponse, CommandError> {
    let session_kind = active_session(state, session)?;
    let plugin = matches!(session_kind, ActiveSession::Plugin(_));
    let mut current_url = parse_http_url(&request.url)?;
    let mut current_method = request.method;
    let mut redirected = false;
    let mut headers = request.headers;
    if plugin {
        validate_plugin_http_headers(&headers)?;
    }
    let mut body = request.body;
    let mut visited = BTreeSet::new();
    visited.insert(current_url.as_str().to_owned());

    loop {
        reauthorize_http(state, session, &current_url, &current_method, plugin)?;
        let pinned = resolve_and_validate_address(&current_url).await?;
        reauthorize_http(state, session, &current_url, &current_method, plugin)?;
        let host = current_url
            .host_str()
            .ok_or_else(|| invalid_request("HTTP URL has no host"))?;
        let resolve_host = unbracketed_host(host);
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .resolve(resolve_host, pinned)
            .build()
            .map_err(|error| operation_error("http_client", error))?;
        let method = reqwest::Method::from_bytes(current_method.as_str().as_bytes())
            .map_err(|_| invalid_request("invalid HTTP method"))?;
        let mut outgoing = client.request(method, current_url.clone());
        for header in &headers {
            let name = reqwest::header::HeaderName::from_bytes(header.name.as_bytes())
                .map_err(|_| invalid_request("invalid HTTP header name"))?;
            let value = reqwest::header::HeaderValue::from_str(&header.value)
                .map_err(|_| invalid_request("invalid HTTP header value"))?;
            outgoing = outgoing.header(name, value);
        }
        if let Some(bytes) = &body {
            outgoing = outgoing.body(bytes.clone());
        }
        let response = outgoing
            .send()
            .await
            .map_err(|error| operation_error("http_fetch", error))?;
        reauthorize_http(state, session, &current_url, &current_method, plugin)?;

        if is_fetch_redirect_status(response.status()) {
            let Some(location) = response.headers().get(reqwest::header::LOCATION) else {
                return Ok(PendingHttpResponse {
                    response,
                    url: current_url,
                    method: current_method,
                    plugin,
                    redirected,
                });
            };
            let location = location
                .to_str()
                .map_err(|_| invalid_request("redirect location is not valid text"))?;
            let next_url = parse_http_url(
                current_url
                    .join(location)
                    .map_err(|_| invalid_request("invalid redirect location"))?
                    .as_str(),
            )?;
            if !visited.insert(next_url.as_str().to_owned()) {
                return Err(invalid_request("HTTP redirect cycle detected"));
            }
            let next_method = redirected_method(response.status(), &current_method)?;
            if next_method.as_str() != current_method.as_str() {
                body = None;
                headers.retain(|header| {
                    !matches!(
                        header.name.to_ascii_lowercase().as_str(),
                        "content-length" | "content-type" | "transfer-encoding"
                    )
                });
            }
            if current_url.origin() != next_url.origin() {
                headers.retain(|header| {
                    !matches!(
                        header.name.to_ascii_lowercase().as_str(),
                        "authorization" | "cookie" | "proxy-authorization"
                    )
                });
            }
            current_url = next_url;
            current_method = next_method;
            redirected = true;
            continue;
        }
        return Ok(PendingHttpResponse {
            response,
            url: current_url,
            method: current_method,
            plugin,
            redirected,
        });
    }
}

fn reauthorize_http(
    state: &BrokerState,
    session: &SessionToken,
    url: &reqwest::Url,
    method: &HttpMethod,
    plugin: bool,
) -> Result<(), CommandError> {
    if plugin {
        require_plugin(state, session)?;
        lock_authorizer(state).authorize_http_redirect(
            session,
            url.as_str().to_owned(),
            method.clone(),
        )?;
    } else {
        require_host(state, session)?;
    }
    Ok(())
}

fn validate_plugin_http_headers(headers: &[HttpHeader]) -> Result<(), CommandError> {
    if headers.iter().any(|header| {
        header.name.eq_ignore_ascii_case("host") || header.name.eq_ignore_ascii_case(":authority")
    }) {
        return Err(invalid_request(
            "plugin HTTP requests cannot override Host or :authority",
        ));
    }
    Ok(())
}

async fn download_http(
    state: &BrokerState,
    session: &SessionToken,
    request: HttpRequest,
    destination: PathBuf,
    events: Option<Channel<BrokerEvent>>,
) -> Result<HttpResponse, CommandError> {
    let _destination_lease = state
        .downloads
        .try_lease_destination(destination.clone())
        .map_err(|error| operation_error("http_download_destination", error))?;
    let pending = send_http(state, session, request).await?;
    write_http_download(state, session, pending, destination, events).await
}

struct PreparedBatchDownload {
    entry: DownloadEntry,
    destination: PathBuf,
    _destination_lease: DestinationLease,
}

struct CompletedBatchDownload {
    entry: DownloadEntry,
    result: Result<(), DownloadTransferError>,
}

struct BatchFileProgress {
    downloaded: u64,
    total: Option<u64>,
    started: Instant,
}

type BatchProgress = Arc<Mutex<BTreeMap<PathBuf, BatchFileProgress>>>;
type BatchEvents = Arc<Mutex<Option<Channel<BrokerEvent>>>>;

struct DownloadBatchOptions {
    generation: u64,
    entries: Vec<DownloadEntry>,
    concurrency: usize,
    label: String,
    cancel_id: String,
    events: Option<Channel<BrokerEvent>>,
}

struct BatchExecution {
    cancellation: Arc<DownloadCancellation>,
    progress: BatchProgress,
    events: BatchEvents,
    success: Arc<AtomicUsize>,
    failed: Arc<AtomicUsize>,
}

async fn download_batch(
    state: &BrokerState,
    session: &SessionToken,
    options: DownloadBatchOptions,
) -> DownloadReport {
    let DownloadBatchOptions {
        generation,
        entries,
        concurrency,
        label,
        cancel_id,
        events,
    } = options;
    let registration = state
        .downloads
        .register_batch(session, generation, &cancel_id);
    let execution = BatchExecution {
        cancellation: registration.cancellation(),
        success: Arc::new(AtomicUsize::new(0)),
        failed: Arc::new(AtomicUsize::new(0)),
        progress: Arc::default(),
        events: Arc::new(Mutex::new(events)),
    };
    let mut failures = Vec::new();
    let mut prepared = Vec::with_capacity(entries.len());

    for entry in entries {
        if execution.cancellation.is_cancelled() {
            break;
        }
        let resolved = resolve_storage_path(
            state,
            session,
            &entry.path,
            None,
            StorageAccess::Write,
            false,
        );
        let destination = match resolved {
            Ok(destination) => destination,
            Err(error) => {
                if execution.cancellation.is_cancelled() {
                    break;
                }
                execution.failed.fetch_add(1, Ordering::Relaxed);
                failures.push(FailedDownload {
                    url: entry.url,
                    path: entry.path,
                    error: command_error_message(&error),
                });
                continue;
            }
        };
        if execution.cancellation.is_cancelled() {
            break;
        }
        match state.downloads.try_lease_destination(destination.clone()) {
            Ok(destination_lease) => prepared.push(PreparedBatchDownload {
                entry,
                destination,
                _destination_lease: destination_lease,
            }),
            Err(error) => {
                if execution.cancellation.is_cancelled() {
                    break;
                }
                execution.failed.fetch_add(1, Ordering::Relaxed);
                failures.push(FailedDownload {
                    url: entry.url,
                    path: entry.path,
                    error,
                });
            }
        }
    }

    emit_batch_progress(
        &execution.progress,
        &execution.events,
        &execution.success,
        &execution.failed,
        false,
    );

    type ActiveDownload<'a> = Pin<Box<dyn Future<Output = CompletedBatchDownload> + Send + 'a>>;
    let worker_limit = concurrency.max(1).min(prepared.len().max(1));
    let mut remaining = prepared.into_iter();
    let mut active: Vec<ActiveDownload<'_>> = Vec::with_capacity(worker_limit);

    for _ in 0..worker_limit {
        let Some(download) = remaining.next() else {
            break;
        };
        active.push(Box::pin(download_batch_entry(
            state, session, download, &execution,
        )));
    }

    while !active.is_empty() {
        let (completed_index, completed) = poll_fn(|context| {
            for (index, download) in active.iter_mut().enumerate() {
                if let Poll::Ready(completed) = download.as_mut().poll(context) {
                    return Poll::Ready((index, completed));
                }
            }
            Poll::Pending
        })
        .await;
        drop(active.swap_remove(completed_index));
        execution
            .progress
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(&completed.entry.path);
        match completed.result {
            Ok(()) => {
                execution.success.fetch_add(1, Ordering::Relaxed);
                log::debug!("{label}: downloaded '{}'", completed.entry.url);
            }
            Err(DownloadTransferError::Cancelled) => {
                log::debug!("{label}: cancelled '{}'", completed.entry.url);
            }
            Err(DownloadTransferError::Command(error)) => {
                execution.failed.fetch_add(1, Ordering::Relaxed);
                let message = command_error_message(&error);
                log::error!(
                    "{label}: could not download '{}': {message}",
                    completed.entry.url
                );
                failures.push(FailedDownload {
                    url: completed.entry.url,
                    path: completed.entry.path,
                    error: message,
                });
            }
        }
        emit_batch_progress(
            &execution.progress,
            &execution.events,
            &execution.success,
            &execution.failed,
            false,
        );

        if !execution.cancellation.is_cancelled() {
            if let Some(download) = remaining.next() {
                active.push(Box::pin(download_batch_entry(
                    state, session, download, &execution,
                )));
            }
        }
    }

    let report = DownloadReport {
        success: execution.success.load(Ordering::Relaxed),
        failed: execution.failed.load(Ordering::Relaxed),
        cancelled: execution.cancellation.is_cancelled(),
        failures,
    };
    emit_batch_progress(
        &execution.progress,
        &execution.events,
        &execution.success,
        &execution.failed,
        true,
    );
    drop(registration);
    report
}

async fn download_batch_entry(
    state: &BrokerState,
    session: &SessionToken,
    download: PreparedBatchDownload,
    execution: &BatchExecution,
) -> CompletedBatchDownload {
    let entry = download.entry.clone();
    let request = match HttpMethod::new("GET") {
        Ok(method) => HttpRequest {
            url: entry.url.clone(),
            method,
            headers: Vec::new(),
            body: None,
        },
        Err(error) => {
            return CompletedBatchDownload {
                entry,
                result: Err(DownloadTransferError::Command(error.into())),
            };
        }
    };
    let pending = match await_unless_cancelled(
        Some(&execution.cancellation),
        send_http(state, session, request),
    )
    .await
    {
        Ok(Ok(pending)) => pending,
        Ok(Err(_error)) if execution.cancellation.is_cancelled() => {
            return CompletedBatchDownload {
                entry,
                result: Err(DownloadTransferError::Cancelled),
            };
        }
        Ok(Err(error)) => {
            return CompletedBatchDownload {
                entry,
                result: Err(DownloadTransferError::Command(error)),
            };
        }
        Err(error) => {
            return CompletedBatchDownload {
                entry,
                result: Err(error),
            };
        }
    };

    let progress_path = entry.path.clone();
    let result = stream_http_download(
        state,
        session,
        pending,
        download.destination,
        Some(&execution.cancellation),
        |transferred, total| {
            let mut current = execution
                .progress
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let file = current
                .entry(progress_path.clone())
                .or_insert_with(|| BatchFileProgress {
                    downloaded: 0,
                    total,
                    started: Instant::now(),
                });
            file.downloaded = transferred;
            file.total = total;
            drop(current);
            emit_batch_progress(
                &execution.progress,
                &execution.events,
                &execution.success,
                &execution.failed,
                false,
            );
        },
    )
    .await;
    let result = match result {
        Ok(_) => Ok(()),
        Err(DownloadTransferError::Command(_)) if execution.cancellation.is_cancelled() => {
            Err(DownloadTransferError::Cancelled)
        }
        Err(error) => Err(error),
    };
    CompletedBatchDownload { entry, result }
}

fn emit_batch_progress(
    progress: &BatchProgress,
    events: &BatchEvents,
    success: &AtomicUsize,
    failed: &AtomicUsize,
    terminal: bool,
) {
    let current = if terminal {
        BTreeMap::new()
    } else {
        progress
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .iter()
            .map(|(path, file)| {
                let percent = file.total.filter(|total| *total != 0).map_or(0, |total| {
                    (file.downloaded.saturating_mul(100) / total).min(100) as u8
                });
                let elapsed = file.started.elapsed().as_secs_f64();
                let bytes_per_second = if elapsed > 0.0 {
                    (file.downloaded as f64 / elapsed) as u64
                } else {
                    0
                };
                (path.clone(), (percent, bytes_per_second))
            })
            .collect()
    };
    let mut events = events
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(channel) = events.as_ref() else {
        return;
    };
    if channel
        .send(BrokerEvent::DownloadBatchProgress {
            current,
            success: success.load(Ordering::Relaxed),
            failed: failed.load(Ordering::Relaxed),
        })
        .is_err()
    {
        *events = None;
    }
}

fn command_error_message(error: &CommandError) -> String {
    match error {
        CommandError::WrongWebview => "request came from the wrong webview".to_owned(),
        CommandError::InvalidRequest { message }
        | CommandError::Unauthorized { message }
        | CommandError::Internal { message } => message.clone(),
        CommandError::OperationFailed { operation, message } => {
            format!("{operation}: {message}")
        }
    }
}

enum DownloadTransferError {
    Cancelled,
    Command(CommandError),
}

async fn await_unless_cancelled<T>(
    cancellation: Option<&DownloadCancellation>,
    future: impl Future<Output = T>,
) -> Result<T, DownloadTransferError> {
    if let Some(cancellation) = cancellation {
        tokio::select! {
            biased;
            _ = cancellation.cancelled() => Err(DownloadTransferError::Cancelled),
            value = future => Ok(value),
        }
    } else {
        Ok(future.await)
    }
}

struct PartialWriter {
    file: Option<tokio::fs::File>,
    partial: Option<PartialDownload>,
}

impl PartialWriter {
    fn file_mut(&mut self) -> &mut tokio::fs::File {
        self.file
            .as_mut()
            .expect("partial writer must own its file")
    }

    fn commit(mut self, destination: &Path) -> Result<(), DownloadTransferError> {
        drop(self.file.take());
        self.partial
            .take()
            .expect("partial writer must own its cleanup guard")
            .commit(destination)
            .map_err(|error| {
                DownloadTransferError::Command(operation_error("http_download_commit", error))
            })
    }
}

async fn create_partial_writer(
    state: &BrokerState,
    destination: &Path,
    cancellation: Option<&DownloadCancellation>,
) -> Result<PartialWriter, DownloadTransferError> {
    let parent = destination.parent().ok_or_else(|| {
        DownloadTransferError::Command(invalid_request(
            "HTTP download destination has no parent directory",
        ))
    })?;
    // Tokio filesystem futures may continue their blocking side effect after the future is
    // dropped. Await directory creation and partial-file reservation to completion so every
    // created partial is paired with a cleanup guard before cancellation can be observed.
    tokio::fs::create_dir_all(parent).await.map_err(|error| {
        DownloadTransferError::Command(operation_error("http_download_directory", error))
    })?;
    if cancellation.is_some_and(DownloadCancellation::is_cancelled) {
        return Err(DownloadTransferError::Cancelled);
    }

    for _ in 0..128 {
        let partial_path = state
            .downloads
            .next_partial_path(destination)
            .map_err(|error| {
                DownloadTransferError::Command(operation_error("http_download_partial", error))
            })?;
        let mut options = tokio::fs::OpenOptions::new();
        options.write(true).create_new(true);
        match options.open(&partial_path).await {
            Ok(file) => {
                let writer = PartialWriter {
                    file: Some(file),
                    partial: Some(PartialDownload::new(partial_path)),
                };
                if cancellation.is_some_and(DownloadCancellation::is_cancelled) {
                    return Err(DownloadTransferError::Cancelled);
                }
                return Ok(writer);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(DownloadTransferError::Command(operation_error(
                    "http_download_partial",
                    error,
                )));
            }
        }
    }
    Err(DownloadTransferError::Command(
        CommandError::OperationFailed {
            operation: "http_download_partial",
            message: "could not reserve a collision-free partial path".to_owned(),
        },
    ))
}

async fn write_http_download(
    state: &BrokerState,
    session: &SessionToken,
    pending: PendingHttpResponse,
    destination: PathBuf,
    mut events: Option<Channel<BrokerEvent>>,
) -> Result<HttpResponse, CommandError> {
    let started = Instant::now();
    stream_http_download(
        state,
        session,
        pending,
        destination,
        None,
        |transferred, total| {
            send_download_progress(&mut events, transferred, total, started);
        },
    )
    .await
    .map_err(|error| match error {
        DownloadTransferError::Cancelled => CommandError::Internal {
            message: "uncancellable HTTP download was cancelled".to_owned(),
        },
        DownloadTransferError::Command(error) => error,
    })
}

async fn stream_http_download(
    state: &BrokerState,
    session: &SessionToken,
    pending: PendingHttpResponse,
    destination: PathBuf,
    cancellation: Option<&DownloadCancellation>,
    mut on_progress: impl FnMut(u64, Option<u64>),
) -> Result<HttpResponse, DownloadTransferError> {
    use tokio::io::AsyncWriteExt;

    let PendingHttpResponse {
        mut response,
        url,
        method,
        plugin,
        redirected,
    } = pending;
    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or_default()
        .to_owned();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| HttpHeader {
            name: name.as_str().to_owned(),
            value: value.to_str().unwrap_or_default().to_owned(),
        })
        .collect();
    let total = response.content_length();
    let mut transferred = 0_u64;
    reauthorize_http(state, session, &url, &method, plugin)
        .map_err(DownloadTransferError::Command)?;
    if !response.status().is_success() {
        return Err(DownloadTransferError::Command(
            CommandError::OperationFailed {
                operation: "http_download_status",
                message: format!("HTTP download returned status {status} {status_text}"),
            },
        ));
    }
    let mut writer = create_partial_writer(state, &destination, cancellation).await?;
    on_progress(0, total);
    while let Some(chunk) = await_unless_cancelled(cancellation, response.chunk())
        .await?
        .map_err(|error| DownloadTransferError::Command(operation_error("http_download", error)))?
    {
        reauthorize_http(state, session, &url, &method, plugin)
            .map_err(DownloadTransferError::Command)?;
        await_unless_cancelled(cancellation, writer.file_mut().write_all(&chunk))
            .await?
            .map_err(|error| {
                DownloadTransferError::Command(operation_error("http_download", error))
            })?;
        transferred = transferred.saturating_add(chunk.len() as u64);
        on_progress(transferred, total);
    }
    await_unless_cancelled(cancellation, writer.file_mut().sync_all())
        .await?
        .map_err(|error| DownloadTransferError::Command(operation_error("http_download", error)))?;
    reauthorize_http(state, session, &url, &method, plugin)
        .map_err(DownloadTransferError::Command)?;
    if let Some(cancellation) = cancellation {
        cancellation
            .commit_if_active(|| writer.commit(&destination))
            .map_err(|()| DownloadTransferError::Cancelled)??;
    } else {
        writer.commit(&destination)?;
    }
    Ok(HttpResponse {
        status,
        status_text,
        headers,
        body: Vec::new(),
        url: url.to_string(),
        redirected,
    })
}

fn send_download_progress(
    events: &mut Option<Channel<BrokerEvent>>,
    transferred: u64,
    total: Option<u64>,
    started: Instant,
) {
    let Some(channel) = events.as_ref() else {
        return;
    };
    let elapsed = started.elapsed().as_secs_f64();
    let bytes_per_second = if elapsed > 0.0 {
        (transferred as f64 / elapsed) as u64
    } else {
        0
    };
    if channel
        .send(BrokerEvent::DownloadProgress {
            transferred,
            total,
            bytes_per_second,
        })
        .is_err()
    {
        *events = None;
    }
}

fn parse_http_url(url: &str) -> Result<reqwest::Url, CommandError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| invalid_request("invalid HTTP URL"))?;
    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.host_str().is_none()
    {
        return Err(invalid_request(
            "HTTP URL must use http or https without credentials",
        ));
    }
    Ok(parsed)
}

async fn resolve_and_validate_address(url: &reqwest::Url) -> Result<SocketAddr, CommandError> {
    let host = url
        .host_str()
        .ok_or_else(|| invalid_request("HTTP URL has no host"))?;
    let resolve_host = unbracketed_host(host);
    let port = url
        .port_or_known_default()
        .ok_or_else(|| invalid_request("HTTP URL has no effective port"))?;
    let addresses = tokio::net::lookup_host((resolve_host, port))
        .await
        .map_err(|error| operation_error("http_dns", error))?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err(CommandError::OperationFailed {
            operation: "http_dns",
            message: "host did not resolve to an address".to_owned(),
        });
    }

    // Inference: an exact authorizer origin grant whose literal host is localhost or an IP is an
    // explicit opt-in to that address. Named domains resolving to local/private space are rejected.
    let explicitly_local =
        resolve_host.eq_ignore_ascii_case("localhost") || resolve_host.parse::<IpAddr>().is_ok();
    if !explicitly_local
        && addresses
            .iter()
            .any(|address| is_local_address(address.ip()))
    {
        return Err(invalid_request(
            "named HTTP origin resolved to a private, loopback, or link-local address",
        ));
    }
    addresses
        .into_iter()
        .find(|address| explicitly_local || !is_local_address(address.ip()))
        .ok_or_else(|| invalid_request("HTTP origin has no permitted address"))
}

fn unbracketed_host(host: &str) -> &str {
    host.strip_prefix('[')
        .and_then(|host| host.strip_suffix(']'))
        .unwrap_or(host)
}

fn is_local_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            let [first, second, third, _fourth] = address.octets();
            first == 0
                || first == 10
                || (first == 100 && (second & 0xc0) == 64)
                || first == 127
                || (first == 169 && second == 254)
                || (first == 172 && (second & 0xf0) == 16)
                || (first == 192 && second == 0 && third == 0)
                || (first == 192 && second == 0 && third == 2)
                || (first == 192 && second == 88 && third == 99)
                || (first == 192 && second == 168)
                || (first == 198 && matches!(second, 18 | 19))
                || (first == 198 && second == 51 && third == 100)
                || (first == 203 && second == 0 && third == 113)
                || first >= 224
        }
        IpAddr::V6(address) => {
            let segments = address.segments();
            if segments[..5] == [0, 0, 0, 0, 0] && segments[5] == 0xffff {
                let mapped = std::net::Ipv4Addr::new(
                    (segments[6] >> 8) as u8,
                    segments[6] as u8,
                    (segments[7] >> 8) as u8,
                    segments[7] as u8,
                );
                return is_local_address(IpAddr::V4(mapped));
            }
            if segments[0] == 0x0064 && segments[1] == 0xff9b && segments[2..6] == [0, 0, 0, 0] {
                let translated = std::net::Ipv4Addr::new(
                    (segments[6] >> 8) as u8,
                    segments[6] as u8,
                    (segments[7] >> 8) as u8,
                    segments[7] as u8,
                );
                if is_local_address(IpAddr::V4(translated)) {
                    return true;
                }
            }
            let first = segments[0];
            address.is_unspecified()
                || address.is_loopback()
                || segments[..6] == [0, 0, 0, 0, 0, 0]
                || (first == 0x0064 && segments[1] == 0xff9b && segments[2] == 1)
                || (first == 0x0100 && segments[1..4] == [0, 0, 0])
                || (first == 0x2001 && segments[1] <= 0x01ff)
                || (first == 0x2001 && segments[1] == 0x0db8)
                || first == 0x2002
                || (first & 0xfff0) == 0x3ff0
                || first == 0x5f00
                || (first & 0xfe00) == 0xfc00
                || (first & 0xffc0) == 0xfe80
                || (first & 0xffc0) == 0xfec0
                || (first & 0xff00) == 0xff00
        }
    }
}

fn is_fetch_redirect_status(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 301 | 302 | 303 | 307 | 308)
}

fn redirected_method(
    status: reqwest::StatusCode,
    method: &HttpMethod,
) -> Result<HttpMethod, CommandError> {
    let next = match status.as_u16() {
        303 if method.as_str() != "HEAD" => "GET",
        301 | 302 if method.as_str() == "POST" => "GET",
        _ => method.as_str(),
    };
    HttpMethod::new(next).map_err(Into::into)
}

async fn collect_http_response(
    response: reqwest::Response,
    url: reqwest::Url,
    redirected: bool,
) -> Result<HttpResponse, CommandError> {
    let status = response.status().as_u16();
    if !(200..=599).contains(&status) {
        return Err(CommandError::OperationFailed {
            operation: "http_response_status",
            message: format!("HTTP status {status} cannot be represented as a Fetch response"),
        });
    }
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or_default()
        .to_owned();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| HttpHeader {
            name: name.as_str().to_owned(),
            value: value.to_str().unwrap_or_default().to_owned(),
        })
        .collect();
    let body = response
        .bytes()
        .await
        .map_err(|error| operation_error("http_body", error))?
        .to_vec();
    Ok(HttpResponse {
        status,
        status_text,
        headers,
        body,
        url: url.to_string(),
        redirected,
    })
}

fn invalid_request(message: impl Into<String>) -> CommandError {
    CommandError::InvalidRequest {
        message: message.into(),
    }
}

fn operation_error(operation: &'static str, error: impl std::fmt::Display) -> CommandError {
    CommandError::OperationFailed {
        operation,
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn method(value: &str) -> HttpMethod {
        HttpMethod::new(value).expect("test method should be valid")
    }

    #[test]
    fn txiki_sidecar_uses_nonce_bound_readiness_after_binding() {
        let nonce = "trusted-readiness-nonce";
        assert_eq!(
            txiki_server_arguments(Path::new("/trusted/wrapper.js")),
            ["run", "/trusted/wrapper.js"]
        );

        let mut output = vec![b'x'; 8 * 1024];
        append_txiki_readiness_output(
            &mut output,
            b"\nListening on http://localhost:31337/\nKAEDE_TXIKI_READY_trusted-readiness-nonce:42069\n",
        );
        assert_eq!(parse_txiki_ready_port(&output, nonce), Some(42_069));
        assert_eq!(
            parse_txiki_ready_port(b"KAEDE_TXIKI_READY_attacker:31337\n", nonce),
            None
        );
        assert_eq!(
            parse_txiki_ready_port(b"KAEDE_TXIKI_READY_trusted-readiness-nonce:0\n", nonce,),
            None
        );

        let wrapper = txiki_server_wrapper(Path::new("/trusted/server.js"), nonce)
            .expect("wrapper source should serialize");
        let bind_position = wrapper
            .find("const server = serve(")
            .expect("wrapper should bind the server");
        let readiness_position = wrapper
            .find("KAEDE_TXIKI_READY_trusted-readiness-nonce:")
            .expect("wrapper should contain the nonce-bound marker");
        assert!(bind_position < readiness_position);
    }

    #[test]
    fn batch_download_contract_uses_typed_camel_case_wire_shapes() {
        let request: BrokerRequest = serde_json::from_value(serde_json::json!({
            "kind": "host_download_batch",
            "entries": [{
                "url": "https://example.test/artifact.bin",
                "path": "/tmp/artifact.bin"
            }],
            "concurrency": 0,
            "label": "libraries",
            "cancelId": "launch-1"
        }))
        .expect("typed batch request should deserialize");
        assert!(matches!(
            request,
            BrokerRequest::HostDownloadBatch {
                concurrency: 0,
                ref cancel_id,
                ..
            } if cancel_id == "launch-1"
        ));
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_cancel_downloads",
            "cancelId": "launch-1",
            "rawCommand": "cancel_downloads"
        }))
        .is_err());

        let response = BrokerResponse::DownloadReport {
            success: 2,
            failed: 1,
            cancelled: true,
            failures: vec![FailedDownload {
                url: "https://example.test/broken.bin".to_owned(),
                path: PathBuf::from("/tmp/broken.bin"),
                error: "stream failed".to_owned(),
            }],
        };
        assert_eq!(
            serde_json::to_value(response).expect("batch report should serialize"),
            serde_json::json!({
                "kind": "download_report",
                "success": 2,
                "failed": 1,
                "cancelled": true,
                "failures": [{
                    "url": "https://example.test/broken.bin",
                    "path": "/tmp/broken.bin",
                    "error": "stream failed"
                }]
            })
        );
        assert_eq!(
            serde_json::to_value(BrokerEvent::DownloadBatchProgress {
                current: BTreeMap::new(),
                success: 2,
                failed: 1,
            })
            .expect("terminal batch progress should serialize"),
            serde_json::json!({
                "kind": "download_batch_progress",
                "current": {},
                "success": 2,
                "failed": 1
            })
        );
    }

    fn broker_test_state(name: &str) -> BrokerState {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        BrokerState::new(
            std::env::temp_dir()
                .join(format!("kaede-broker-{name}-{suffix}"))
                .join("capability-decisions.json"),
        )
        .expect("broker state should initialize")
    }

    fn history_test_principal() -> Principal {
        Principal::new(
            "https://plugins.example.test/owner/history-test",
            "example.history-test",
            "1.0.0",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
    }

    fn open_history_test_session(
        state: &BrokerState,
        principal: &Principal,
        label: &str,
    ) -> (SessionToken, SessionToken) {
        let host = SessionToken::new(format!("{label}-host"));
        let plugin = SessionToken::new(format!("{label}-plugin"));
        let mut authorizer = lock_authorizer(state);
        authorizer
            .bootstrap_host(host.clone(), 1)
            .expect("history-test host should bootstrap");
        authorizer
            .open_plugin(&host, plugin.clone(), principal.clone())
            .expect("history-test plugin should open");
        drop(authorizer);
        state.operations.register(plugin.clone());
        (host, plugin)
    }

    fn history_test_process_grant() -> PreparedGrant {
        PreparedGrant::without_storage(CapabilityGrant {
            permission: PermissionId::SystemProcessSpawn,
            scope: PermissionScope::Process(ProcessScope {
                rules: vec![ProcessRule::exact(
                    "/usr/bin/git",
                    ProcessTargetIdentity::new(
                        "1",
                        "10",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                    vec!["status".to_owned()],
                )],
            }),
        })
    }

    fn history_test_storage_grant(permission: PermissionId) -> PreparedGrant {
        let scope = match permission {
            PermissionId::StorageInternalWrite => {
                PermissionScope::InternalStorage(InternalStorageScope {
                    principal_directory: PathBuf::from("/data/plugins/example.history-test"),
                })
            }
            PermissionId::StorageExternalWrite => {
                PermissionScope::ExternalStorage(ExternalStorageScope {
                    canonical_roots: vec![PathBuf::from("/home/user/Documents/allowed")],
                })
            }
            _ => panic!("history test requires a storage write permission"),
        };
        PreparedGrant::without_storage(CapabilityGrant { permission, scope })
    }

    fn install_legacy_external_grant(
        state: &BrokerState,
        host: &SessionToken,
        plugin: &SessionToken,
        permission: PermissionId,
        requested_root: &Path,
    ) {
        let canonical_root = std::fs::canonicalize(requested_root)
            .expect("legacy external root should canonicalize");
        let directory =
            cap_std::fs::Dir::open_ambient_dir(&canonical_root, cap_std::ambient_authority())
                .expect("legacy external root should open");
        let identity = FileIdentity::from_metadata(
            &directory
                .dir_metadata()
                .expect("legacy external root metadata should be readable"),
        );
        lock_authorizer(state)
            .grant(
                host,
                plugin,
                CapabilityGrant {
                    permission,
                    scope: PermissionScope::ExternalStorage(ExternalStorageScope {
                        canonical_roots: vec![canonical_root.clone()],
                    }),
                },
            )
            .expect("legacy authorizer grant should be installed for the regression fixture");
        state.storage_roots.install(
            plugin,
            vec![super::super::PreparedStorageRoot {
                permission,
                canonical_root,
                identity,
                directory: std::sync::Arc::new(directory),
            }],
        );
    }

    fn prepared_external_test_grant(
        state: &BrokerState,
        permission: PermissionId,
        requested_root: &Path,
    ) -> PreparedGrant {
        let prepared = state
            .storage_roots
            .prepare_external(permission, requested_root)
            .expect("external test root should prepare");
        let canonical_root = prepared.canonical_root.clone();
        PreparedGrant {
            grant: CapabilityGrant {
                permission,
                scope: PermissionScope::ExternalStorage(ExternalStorageScope {
                    canonical_roots: vec![canonical_root],
                }),
            },
            storage_roots: vec![prepared],
        }
    }

    #[test]
    fn remembered_process_history_survives_revoke_and_blocks_write_in_a_fresh_runtime() {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let decisions_path = std::env::temp_dir()
            .join(format!("kaede-history-remembered-process-{suffix}"))
            .join("capability-decisions.json");
        let principal = history_test_principal();
        let remembered_key = DecisionKey {
            kind: DecisionKind::Dynamic,
            principal_key: "plugin-principal-v2:sha256:remembered-process".to_owned(),
            request_fingerprint: "permission-request-v2:sha256:remembered-process".to_owned(),
        };

        {
            let state =
                BrokerState::new(decisions_path.clone()).expect("first runtime should initialize");
            state
                .decisions
                .save(remembered_key.clone(), true)
                .expect("process decision should be remembered");
            let (host, plugin) = open_history_test_session(&state, &principal, "first");
            grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_process_grant(),
            )
            .expect("first process grant should apply");
            lock_authorizer(&state)
                .revoke_plugin(&host, &plugin)
                .expect("first session should revoke");
        }

        {
            let state =
                BrokerState::new(decisions_path.clone()).expect("second runtime should initialize");
            assert_eq!(
                state
                    .decisions
                    .load(&remembered_key)
                    .expect("remembered process decision should load"),
                Some(true)
            );
            let (host, plugin) = open_history_test_session(&state, &principal, "second");
            let error = grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_storage_grant(PermissionId::StorageInternalWrite),
            )
            .expect_err("fresh runtime must reject write after remembered process grant");
            assert!(matches!(
                error,
                CommandError::OperationFailed {
                    operation: "grant_principal_capability_history",
                    ..
                }
            ));
            assert_eq!(
                lock_authorizer(&state).authorize_operation(
                    &plugin,
                    PermissionId::StorageInternalWrite,
                    &Operation::InternalStorage {
                        canonical_path: PathBuf::from(
                            "/data/plugins/example.history-test/script.js"
                        ),
                    },
                ),
                Err(AuthorizationError::PermissionDenied(
                    PermissionId::StorageInternalWrite
                ))
            );
        }

        {
            let state =
                BrokerState::new(decisions_path.clone()).expect("third runtime should initialize");
            let (host, plugin) = open_history_test_session(&state, &principal, "third");
            grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_process_grant(),
            )
            .expect("same-family process history should remain usable");
        }

        let _ = std::fs::remove_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        );
    }

    #[test]
    fn unremembered_write_history_blocks_process_in_a_fresh_runtime() {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let decisions_path = std::env::temp_dir()
            .join(format!("kaede-history-unremembered-write-{suffix}"))
            .join("capability-decisions.json");
        let principal = history_test_principal();

        {
            let state =
                BrokerState::new(decisions_path.clone()).expect("write runtime should initialize");
            let (host, plugin) = open_history_test_session(&state, &principal, "write");
            grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_storage_grant(PermissionId::StorageExternalWrite),
            )
            .expect("unremembered write grant should apply and still record history");
        }

        {
            let state = BrokerState::new(decisions_path.clone())
                .expect("process runtime should initialize");
            let (host, plugin) = open_history_test_session(&state, &principal, "process");
            let error = grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_process_grant(),
            )
            .expect_err("fresh runtime must reject process after unremembered write grant");
            assert!(matches!(
                error,
                CommandError::OperationFailed {
                    operation: "grant_principal_capability_history",
                    ..
                }
            ));
            assert_eq!(
                lock_authorizer(&state).authorize_operation(
                    &plugin,
                    PermissionId::SystemProcessSpawn,
                    &Operation::Process {
                        executable: PathBuf::from("/usr/bin/git"),
                        target_identity: ProcessTargetIdentity::new(
                            "1",
                            "10",
                            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        ),
                        arguments: vec!["status".to_owned()],
                    },
                ),
                Err(AuthorizationError::PermissionDenied(
                    PermissionId::SystemProcessSpawn
                ))
            );
        }

        let _ = std::fs::remove_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        );
    }

    #[test]
    fn legacy_external_grants_cannot_read_write_or_remove_private_history() {
        use crate::plugin_broker::decisions::principal_history_path;

        for first_family in ["process", "storage-write"] {
            let mut random = [0_u8; 8];
            getrandom::fill(&mut random).expect("test randomness should be available");
            let suffix = random
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>();
            let fixture_root =
                std::env::temp_dir().join(format!("kaede-private-history-{first_family}-{suffix}"));
            let private_root = fixture_root.join("private-app-data");
            let decisions_path = private_root.join("capability-decisions.json");
            let history_path = principal_history_path(&decisions_path);
            let private_child = private_root.join("attacker-selected-child");
            let legacy_decoy = fixture_root.join("outside-private");
            let principal = history_test_principal();

            {
                let state = BrokerState::new(decisions_path.clone())
                    .expect("initial runtime should initialize");
                let (host, plugin) =
                    open_history_test_session(&state, &principal, "initial-family");
                let grant = if first_family == "process" {
                    history_test_process_grant()
                } else {
                    history_test_storage_grant(PermissionId::StorageExternalWrite)
                };
                grant_plugin_state(&state, &host, &plugin, &principal, grant)
                    .expect("initial capability family should be recorded");
            }
            std::fs::create_dir_all(&private_child).expect("private child should exist");
            std::fs::create_dir_all(&legacy_decoy).expect("legacy decoy should exist");
            let original_history =
                std::fs::read(&history_path).expect("principal capability history should exist");

            {
                let state = BrokerState::new(decisions_path.clone())
                    .expect("attack runtime should initialize");
                let (host, plugin) =
                    open_history_test_session(&state, &principal, "legacy-external");
                for permission in [
                    PermissionId::StorageExternalRead,
                    PermissionId::StorageExternalWrite,
                ] {
                    install_legacy_external_grant(
                        &state,
                        &host,
                        &plugin,
                        permission,
                        &fixture_root,
                    );
                }

                for protected_target in
                    [&fixture_root, &private_root, &private_child, &history_path]
                {
                    assert!(resolve_plugin_storage_target(
                        &state,
                        &plugin,
                        protected_target,
                        StorageAccess::Read,
                        true,
                    )
                    .is_err());
                }
                assert!(resolve_plugin_storage_target(
                    &state,
                    &plugin,
                    &legacy_decoy,
                    StorageAccess::Write,
                    true,
                )
                .is_err());
                assert!(resolve_storage_path(
                    &state,
                    &plugin,
                    &history_path,
                    None,
                    StorageAccess::Read,
                    true,
                )
                .is_err());
                assert!(resolve_storage_path(
                    &state,
                    &plugin,
                    &history_path,
                    None,
                    StorageAccess::Write,
                    true,
                )
                .is_err());

                let valid_empty_history = br#"{"version":1,"principals":[]}"#;
                assert!(
                    plugin_fs_write_bytes(&state, &plugin, &history_path, valid_empty_history,)
                        .is_err()
                );
                assert!(plugin_fs_remove(&state, &plugin, &history_path).is_err());
                let atomic_sibling = private_root.join(".principal-history.attacker.tmp");
                assert!(plugin_fs_write_bytes(
                    &state,
                    &plugin,
                    &atomic_sibling,
                    valid_empty_history,
                )
                .is_err());
                assert_eq!(
                    std::fs::read(&history_path)
                        .expect("denied private operations must preserve history"),
                    original_history
                );
            }

            {
                let state = BrokerState::new(decisions_path.clone())
                    .expect("verification runtime should initialize");
                let (host, plugin) =
                    open_history_test_session(&state, &principal, "opposite-family");
                let opposite_grant = if first_family == "process" {
                    history_test_storage_grant(PermissionId::StorageExternalWrite)
                } else {
                    history_test_process_grant()
                };
                let error = grant_plugin_state(&state, &host, &plugin, &principal, opposite_grant)
                    .expect_err("preserved history must reject the opposite capability family");
                assert!(matches!(
                    error,
                    CommandError::OperationFailed {
                        operation: "grant_principal_capability_history",
                        ..
                    }
                ));
            }

            let _ = std::fs::remove_dir_all(fixture_root);
        }
    }

    #[test]
    fn disjoint_external_storage_remains_usable() {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let fixture_root = std::env::temp_dir().join(format!("kaede-disjoint-storage-{suffix}"));
        let private_root = fixture_root.join("private-app-data");
        let decisions_path = private_root.join("capability-decisions.json");
        let safe_root = fixture_root.join("safe-external");
        std::fs::create_dir_all(&safe_root).expect("safe external root should exist");
        let state =
            BrokerState::new(decisions_path.clone()).expect("broker state should initialize");
        let principal = history_test_principal();
        let (host, plugin) = open_history_test_session(&state, &principal, "safe-external");

        for permission in [
            PermissionId::StorageExternalRead,
            PermissionId::StorageExternalWrite,
        ] {
            let prepared = prepared_external_test_grant(&state, permission, &safe_root);
            grant_plugin_state(&state, &host, &plugin, &principal, prepared)
                .expect("disjoint external storage grant should apply");
        }

        let target_path = safe_root.join("payload.bin");
        plugin_fs_write_bytes(&state, &plugin, &target_path, b"safe")
            .expect("disjoint external write should succeed");
        assert_eq!(
            plugin_fs_read_bytes(&state, &plugin, &target_path)
                .expect("disjoint external payload should be readable"),
            b"safe"
        );
        plugin_fs_write_text(&state, &plugin, &target_path, "replacement")
            .expect("single-link external file should remain writable");
        assert_eq!(
            plugin_fs_read_text(&state, &plugin, &target_path)
                .expect("single-link external text should remain readable"),
            "replacement"
        );
        plugin_fs_remove(&state, &plugin, &target_path)
            .expect("disjoint external remove should succeed");
        assert!(!target_path.exists());

        #[cfg(unix)]
        {
            use crate::plugin_broker::decisions::principal_history_path;
            use std::os::unix::fs::symlink;

            let history_path = principal_history_path(&decisions_path);
            let history_link = safe_root.join("private-history-link");
            symlink(&history_path, &history_link)
                .expect("symlink from safe storage into private history should be created");
            assert!(plugin_fs_remove(&state, &plugin, &history_link).is_err());
            assert!(std::fs::symlink_metadata(&history_link)
                .expect("denied remove must preserve the symlink")
                .file_type()
                .is_symlink());
        }

        let _ = std::fs::remove_dir_all(fixture_root);
    }

    #[cfg(unix)]
    #[test]
    fn external_hardlink_to_private_history_is_rejected_without_modifying_history() {
        use crate::plugin_broker::decisions::principal_history_path;

        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let fixture_root = std::env::temp_dir().join(format!("kaede-hardlink-storage-{suffix}"));
        let private_root = fixture_root.join("private-app-data");
        let decisions_path = private_root.join("capability-decisions.json");
        let history_path = principal_history_path(&decisions_path);
        let safe_root = fixture_root.join("safe-external");
        std::fs::create_dir_all(&safe_root).expect("safe external root should exist");
        let state =
            BrokerState::new(decisions_path.clone()).expect("broker state should initialize");
        let principal = history_test_principal();
        let (host, plugin) = open_history_test_session(&state, &principal, "hardlink-external");

        for permission in [
            PermissionId::StorageExternalRead,
            PermissionId::StorageExternalWrite,
        ] {
            let prepared = prepared_external_test_grant(&state, permission, &safe_root);
            grant_plugin_state(&state, &host, &plugin, &principal, prepared)
                .expect("disjoint external storage grant should apply");
        }

        let original_history =
            std::fs::read(&history_path).expect("principal capability history should exist");
        let history_alias = safe_root.join("private-history-hardlink");
        std::fs::hard_link(&history_path, &history_alias)
            .expect("hard link into granted external storage should be created");

        assert!(plugin_fs_read_bytes(&state, &plugin, &history_alias).is_err());
        assert!(plugin_fs_read_text(&state, &plugin, &history_alias).is_err());
        assert!(plugin_fs_write_bytes(&state, &plugin, &history_alias, b"attacker").is_err());
        assert!(plugin_fs_write_text(&state, &plugin, &history_alias, "attacker").is_err());
        assert!(plugin_fs_remove(&state, &plugin, &history_alias).is_err());
        assert_eq!(
            std::fs::read(&history_path)
                .expect("denied hard-link operations must preserve history"),
            original_history
        );
        assert!(history_alias.exists());

        let _ = std::fs::remove_dir_all(fixture_root);
    }

    #[cfg(unix)]
    #[test]
    fn internal_hardlink_to_private_state_is_rejected_without_modifying_source() {
        use crate::plugin_broker::decisions::principal_history_path;

        let (state, _host, plugin, temp_root, principal_root) =
            storage_test_context("internal-hardlink-private", true);
        std::fs::create_dir_all(&principal_root).expect("principal root should exist");
        let private_path = principal_history_path(&temp_root.join("capability-decisions.json"));
        let original_private = br#"{"version":1,"principals":[]}"#;
        std::fs::write(&private_path, original_private)
            .expect("private-state fixture should be created");
        let relative_alias = Path::new("private-state-hardlink");
        let alias_path = principal_root.join(relative_alias);
        std::fs::hard_link(&private_path, &alias_path)
            .expect("hard link into internal principal storage should be created");

        assert!(plugin_fs_read_bytes(&state, &plugin, relative_alias).is_err());
        assert!(plugin_fs_read_text(&state, &plugin, relative_alias).is_err());
        assert!(plugin_fs_write_bytes(&state, &plugin, relative_alias, b"attacker").is_err());
        assert!(plugin_fs_write_text(&state, &plugin, relative_alias, "attacker").is_err());
        assert!(plugin_fs_remove(&state, &plugin, relative_alias).is_err());
        assert_eq!(
            std::fs::read(&private_path)
                .expect("denied internal hard-link operations must preserve private state"),
            original_private
        );
        assert!(alias_path.exists());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn external_remove_handles_write_only_files_and_fifos_without_blocking_quiescence() {
        use rustix::fs::{mkfifoat, Mode, CWD};
        use std::os::unix::fs::PermissionsExt;
        use std::sync::{Arc, Barrier};
        use std::time::Duration;

        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let fixture_root = std::env::temp_dir().join(format!("kaede-remove-storage-{suffix}"));
        let private_root = fixture_root.join("private-app-data");
        let decisions_path = private_root.join("capability-decisions.json");
        let safe_root = fixture_root.join("safe-external");
        std::fs::create_dir_all(&safe_root).expect("safe external root should exist");
        let state =
            Arc::new(BrokerState::new(decisions_path).expect("broker state should initialize"));
        let principal = history_test_principal();
        let (host, plugin) = open_history_test_session(&state, &principal, "remove-nonblocking");
        let prepared =
            prepared_external_test_grant(&state, PermissionId::StorageExternalWrite, &safe_root);
        grant_plugin_state(&state, &host, &plugin, &principal, prepared)
            .expect("external write grant should apply");

        let write_only_path = safe_root.join("write-only.bin");
        std::fs::write(&write_only_path, b"single-link")
            .expect("write-only fixture should be created");
        std::fs::set_permissions(&write_only_path, std::fs::Permissions::from_mode(0o200))
            .expect("fixture should become write-only");
        plugin_fs_remove(&state, &plugin, &write_only_path)
            .expect("directory-authorized remove should not require content-read access");
        assert!(!write_only_path.exists());

        let fifo_path = safe_root.join("no-writer.fifo");
        mkfifoat(CWD, &fifo_path, Mode::RWXU).expect("FIFO fixture should be created");
        let start = Arc::new(Barrier::new(2));
        let worker_start = Arc::clone(&start);
        let worker_state = Arc::clone(&state);
        let worker_plugin = plugin.clone();
        let worker_fifo = fifo_path.clone();
        let worker = std::thread::spawn(move || {
            let _lease = worker_state
                .operations
                .acquire(&worker_plugin)
                .expect("plugin operation lease should be acquired");
            worker_start.wait();
            plugin_fs_remove(&worker_state, &worker_plugin, &worker_fifo)
        });

        start.wait();
        let activity = state
            .operations
            .cancel(&plugin)
            .expect("registered plugin activity should be cancellable");
        let quiescence =
            tokio::time::timeout(Duration::from_secs(1), activity.wait_quiescent()).await;
        if quiescence.is_err() {
            // Release an implementation that regressed to a blocking FIFO
            // read-open so the test process can join the worker before failing.
            let _ = std::fs::OpenOptions::new().write(true).open(&fifo_path);
        }
        let removal = worker.join().expect("remove worker should terminate");

        assert!(
            quiescence.is_ok(),
            "FIFO removal must not indefinitely retain an operation lease"
        );
        removal.expect("FIFO removal without a writer should succeed");
        assert!(!fifo_path.exists());

        let _ = std::fs::remove_dir_all(fixture_root);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn internal_fifo_read_does_not_block_revoke_quiescence() {
        use rustix::fs::{mkfifoat, Mode, CWD};
        use std::sync::{Arc, Barrier};
        use std::time::Duration;

        let (state, host, plugin, temp_root, principal_root) =
            storage_test_context("internal-fifo-read", true);
        std::fs::create_dir_all(&principal_root).expect("principal root should exist");
        let relative_fifo = PathBuf::from("no-writer.fifo");
        let fifo_path = principal_root.join(&relative_fifo);
        mkfifoat(CWD, &fifo_path, Mode::RWXU).expect("FIFO fixture should be created");
        let state = Arc::new(state);
        let start = Arc::new(Barrier::new(2));
        let worker_start = Arc::clone(&start);
        let worker_state = Arc::clone(&state);
        let worker_plugin = plugin.clone();
        let worker = std::thread::spawn(move || {
            let _lease = worker_state
                .operations
                .acquire(&worker_plugin)
                .expect("plugin operation lease should be acquired");
            let target = resolve_plugin_storage_target(
                &worker_state,
                &worker_plugin,
                &relative_fifo,
                StorageAccess::Read,
                true,
            )
            .expect("internal FIFO target should resolve within its root");
            worker_start.wait();
            let mut options = CapabilityOpenOptions::new();
            options.read(true);
            open_plugin_storage_content_file(&target, options, "test_fifo_read").map(drop)
        });

        start.wait();
        let revocation = tokio::time::timeout(
            Duration::from_secs(1),
            revoke_plugin_state(&state, &host, &plugin),
        )
        .await;
        if revocation.is_err() {
            // Release a regressed blocking read-open before joining the worker.
            let _ = std::fs::OpenOptions::new().write(true).open(&fifo_path);
        }
        let read_result = worker.join().expect("FIFO read worker should terminate");

        assert!(
            revocation.is_ok(),
            "FIFO read must not indefinitely retain an operation lease during revoke"
        );
        revocation
            .expect("FIFO read revoke should reach quiescence")
            .expect("plugin revoke should succeed");
        assert!(read_result.is_err(), "FIFO content read must be rejected");

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn external_regular_to_fifo_write_race_does_not_block_page_reset() {
        use rustix::fs::{mkfifoat, Mode, CWD};
        use std::sync::{mpsc, Arc, Barrier};
        use std::time::Duration;

        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let fixture_root = std::env::temp_dir().join(format!("kaede-write-fifo-{suffix}"));
        let private_root = fixture_root.join("private-app-data");
        let safe_root = fixture_root.join("safe-external");
        std::fs::create_dir_all(&safe_root).expect("safe external root should exist");
        let state = Arc::new(
            BrokerState::new(private_root.join("capability-decisions.json"))
                .expect("broker state should initialize"),
        );
        let principal = history_test_principal();
        let (host, plugin) = open_history_test_session(&state, &principal, "write-fifo-race");
        let prepared =
            prepared_external_test_grant(&state, PermissionId::StorageExternalWrite, &safe_root);
        grant_plugin_state(&state, &host, &plugin, &principal, prepared)
            .expect("external write grant should apply");
        let fifo_path = safe_root.join("regular-then-fifo");
        std::fs::write(&fifo_path, b"regular-before-open")
            .expect("regular fixture should be created");

        let resolved = Arc::new(Barrier::new(2));
        let swapped = Arc::new(Barrier::new(2));
        let worker_resolved = Arc::clone(&resolved);
        let worker_swapped = Arc::clone(&swapped);
        let worker_state = Arc::clone(&state);
        let worker_plugin = plugin.clone();
        let worker_path = fifo_path.clone();
        let worker = std::thread::spawn(move || {
            let _lease = worker_state
                .operations
                .acquire(&worker_plugin)
                .expect("plugin operation lease should be acquired");
            let target = resolve_plugin_storage_target(
                &worker_state,
                &worker_plugin,
                &worker_path,
                StorageAccess::Write,
                false,
            )
            .expect("regular external target should resolve before replacement");
            worker_resolved.wait();
            worker_swapped.wait();
            let mut options = CapabilityOpenOptions::new();
            options.write(true).create(true);
            open_plugin_storage_content_file(&target, options, "test_fifo_write").map(drop)
        });

        resolved.wait();
        std::fs::remove_file(&fifo_path).expect("regular fixture should be removed");
        mkfifoat(CWD, &fifo_path, Mode::RWXU).expect("replacement FIFO should be created");
        swapped.wait();

        let reset_state = Arc::clone(&state);
        let (reset_sender, reset_receiver) = mpsc::sync_channel(1);
        let reset = std::thread::spawn(move || {
            crate::plugin_broker::reset_state_for_page_load(&reset_state);
            reset_sender
                .send(())
                .expect("reset receiver should remain available");
        });
        let reset_result = reset_receiver.recv_timeout(Duration::from_secs(1));
        if reset_result.is_err() {
            // Release a regressed blocking write-open before joining threads.
            let _ = std::fs::OpenOptions::new().read(true).open(&fifo_path);
        }
        let write_result = worker.join().expect("FIFO write worker should terminate");
        reset.join().expect("page reset worker should terminate");

        reset_result.expect("FIFO write must not indefinitely block page-reset quiescence");
        assert!(write_result.is_err(), "FIFO content write must be rejected");

        let _ = std::fs::remove_dir_all(fixture_root);
    }

    #[cfg(unix)]
    #[test]
    fn principal_history_read_and_write_errors_fail_before_grant() {
        use crate::plugin_broker::decisions::principal_history_path;
        use std::os::unix::fs::PermissionsExt;

        for failure_kind in ["read", "write"] {
            let mut random = [0_u8; 8];
            getrandom::fill(&mut random).expect("test randomness should be available");
            let suffix = random
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>();
            let decisions_path = std::env::temp_dir()
                .join(format!("kaede-history-{failure_kind}-failure-{suffix}"))
                .join("capability-decisions.json");
            let history_path = principal_history_path(&decisions_path);
            let state = BrokerState::new(decisions_path.clone())
                .expect("history failure runtime should initialize");
            let principal = history_test_principal();
            let (host, plugin) = open_history_test_session(&state, &principal, failure_kind);
            let parent = decisions_path
                .parent()
                .expect("history path should have a parent");

            if failure_kind == "read" {
                std::fs::write(&history_path, b"not-json")
                    .expect("corrupt history should be written");
            } else {
                std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o500))
                    .expect("history directory should become read-only");
            }

            let error = grant_plugin_state(
                &state,
                &host,
                &plugin,
                &principal,
                history_test_process_grant(),
            )
            .expect_err("history persistence failure must reject the grant");

            if failure_kind == "write" {
                std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))
                    .expect("history directory permissions should be restored");
            }
            assert!(matches!(
                error,
                CommandError::OperationFailed {
                    operation: "grant_principal_capability_history",
                    ..
                }
            ));
            assert_eq!(
                lock_authorizer(&state).authorize_operation(
                    &plugin,
                    PermissionId::SystemProcessSpawn,
                    &Operation::Process {
                        executable: PathBuf::from("/usr/bin/git"),
                        target_identity: ProcessTargetIdentity::new(
                            "1",
                            "10",
                            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        ),
                        arguments: vec!["status".to_owned()],
                    },
                ),
                Err(AuthorizationError::PermissionDenied(
                    PermissionId::SystemProcessSpawn
                ))
            );
            let _ = std::fs::remove_dir_all(parent);
        }
    }

    fn storage_test_context(
        name: &str,
        grant_write: bool,
    ) -> (BrokerState, SessionToken, SessionToken, PathBuf, PathBuf) {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let temp_root = std::env::temp_dir().join(format!("kaede-storage-{name}-{suffix}"));
        let state = BrokerState::new(temp_root.join("capability-decisions.json"))
            .expect("broker state should initialize");
        let host = SessionToken::new("host");
        let plugin = SessionToken::new("plugin");
        let principal = Principal::new(
            "https://plugins.example.test/owner/example",
            "example.plugin",
            "1.0.0",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        {
            let mut authorizer = lock_authorizer(&state);
            authorizer
                .bootstrap_host(host.clone(), 1)
                .expect("host should bootstrap");
            authorizer
                .open_plugin(&host, plugin.clone(), principal.clone())
                .expect("plugin should open");
        }
        state.operations.register(plugin.clone());
        let principal_relative_path = principal_relative_directory(&principal);
        let principal_root = state.storage_roots.principal_path(&principal_relative_path);
        if grant_write {
            let prepared_write_root = state
                .storage_roots
                .prepare_internal(PermissionId::StorageInternalWrite, &principal_relative_path)
                .expect("storage root should open");
            let prepared_read_root = state
                .storage_roots
                .prepare_internal(PermissionId::StorageInternalRead, &principal_relative_path)
                .expect("storage root should open");
            let write_grant = CapabilityGrant {
                permission: PermissionId::StorageInternalWrite,
                scope: PermissionScope::InternalStorage(InternalStorageScope {
                    principal_directory: principal_root.clone(),
                }),
            };
            let read_grant = CapabilityGrant {
                permission: PermissionId::StorageInternalRead,
                scope: PermissionScope::InternalStorage(InternalStorageScope {
                    principal_directory: principal_root.clone(),
                }),
            };
            let mut authorizer = lock_authorizer(&state);
            authorizer
                .grant(&host, &plugin, write_grant)
                .expect("write grant should apply");
            authorizer
                .grant(&host, &plugin, read_grant)
                .expect("read grant should apply");
            drop(authorizer);
            state
                .storage_roots
                .install(&plugin, vec![prepared_write_root, prepared_read_root]);
        }
        (state, host, plugin, temp_root, principal_root)
    }

    async fn local_http_response(status: u16) -> reqwest::Response {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("local HTTP listener should bind");
        let address = listener
            .local_addr()
            .expect("local HTTP address should be available");
        let reason = match status {
            404 => "Not Found",
            500 => "Internal Server Error",
            _ => "Test Status",
        };
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("local HTTP request should connect");
            let mut request = [0_u8; 4096];
            let _ = stream
                .read(&mut request)
                .await
                .expect("local HTTP request should be readable");
            let response = format!(
                "HTTP/1.1 {status} {reason}\r\nContent-Length: 7\r\nConnection: close\r\n\r\nfailure"
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("local HTTP response should be written");
        });
        let response = reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("test HTTP client should build")
            .get(format!("http://{address}/artifact"))
            .send()
            .await
            .expect("local HTTP response should be received");
        server.await.expect("local HTTP server should finish");
        response
    }

    #[test]
    fn broker_request_is_tagged_and_rejects_arbitrary_command_strings() {
        let request: BrokerRequest = serde_json::from_value(serde_json::json!({
            "kind": "plugin_fs_read_text",
            "path": "/tmp/file",
            "baseDirectory": null
        }))
        .expect("typed request should deserialize");
        assert!(matches!(request, BrokerRequest::PluginFsReadText { .. }));

        let request: BrokerRequest = serde_json::from_value(serde_json::json!({
            "kind": "plugin_fs_write_bytes",
            "path": "payload.bin",
            "bytes": [0, 127, 255]
        }))
        .expect("binary write DTO should deserialize");
        assert!(matches!(
            request,
            BrokerRequest::PluginFsWriteBytes { path, bytes }
                if path == Path::new("payload.bin") && bytes == [0, 127, 255]
        ));

        let request: BrokerRequest = serde_json::from_value(serde_json::json!({
            "kind": "plugin_fs_remove",
            "path": "payload.bin"
        }))
        .expect("remove DTO should deserialize");
        assert!(matches!(
            request,
            BrokerRequest::PluginFsRemove { path } if path == Path::new("payload.bin")
        ));

        let request: BrokerRequest = serde_json::from_value(serde_json::json!({
            "kind": "prepare_permission_requests",
            "descriptors": [{
                "id": "storage/external/read",
                "scope": { "roots": ["/tmp/link"] }
            }]
        }))
        .expect("permission preparation DTO should deserialize");
        assert!(matches!(
            request,
            BrokerRequest::PreparePermissionRequests { descriptors }
                if descriptors.len() == 1
        ));

        let prepared_grant = serde_json::json!({
            "kind": "grant_plugin",
            "pluginSession": "plugin-session",
            "prepared": {
                "descriptor": {
                    "id": "storage/external/read",
                    "scope": { "roots": ["/tmp/target"] }
                },
                "targetIdentities": [{
                    "kind": "external_storage_root",
                    "path": "/tmp/target",
                    "identityProvider": "desktop-filesystem-v1",
                    "device": "1",
                    "inode": "10"
                }]
            }
        });
        assert!(serde_json::from_value::<BrokerRequest>(prepared_grant.clone()).is_ok());
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "grant_plugin",
            "pluginSession": "plugin-session",
            "descriptor": "logging/write"
        }))
        .is_err());
        let mut browser_identity = prepared_grant;
        browser_identity["prepared"]["targetIdentities"][0]["identityProvider"] =
            serde_json::json!("browser-preview-logical-v1");
        assert!(serde_json::from_value::<BrokerRequest>(browser_identity).is_err());

        let process_prepared_grant = serde_json::json!({
            "kind": "grant_plugin",
            "pluginSession": "plugin-session",
            "prepared": {
                "descriptor": {
                    "id": "system/process/spawn",
                    "scope": {
                        "executables": [{ "path": "/tmp/tool", "arguments": [] }]
                    }
                },
                "targetIdentities": [{
                    "kind": "process_executable",
                    "path": "/tmp/tool",
                    "identityProvider": "desktop-executable-sha256-v1",
                    "device": "1",
                    "inode": "10",
                    "contentSha256":
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                }]
            }
        });
        assert!(serde_json::from_value::<BrokerRequest>(process_prepared_grant.clone()).is_ok());
        let mut missing_digest = process_prepared_grant.clone();
        missing_digest["prepared"]["targetIdentities"][0]
            .as_object_mut()
            .expect("target identity should be an object")
            .remove("contentSha256");
        assert!(serde_json::from_value::<BrokerRequest>(missing_digest).is_err());
        let mut legacy_process_identity = process_prepared_grant;
        legacy_process_identity["prepared"]["targetIdentities"][0]["identityProvider"] =
            serde_json::json!("desktop-filesystem-v1");
        assert!(serde_json::from_value::<BrokerRequest>(legacy_process_identity).is_err());

        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "command": "plugin:fs|read_text_file",
            "args": { "path": "/tmp/file" }
        }))
        .is_err());
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "plugin:fs|read_text_file",
            "path": "/tmp/file"
        }))
        .is_err());
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "plugin_fs_read_text",
            "path": "/tmp/file",
            "baseDirectory": null,
            "command": "plugin:shellx|execute"
        }))
        .is_err());
    }

    #[test]
    fn initialization_requests_and_responses_use_the_typed_broker_contract() {
        let initial_request = serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_initial_state"
        }))
        .expect("initial-state request should deserialize");
        assert!(matches!(initial_request, BrokerRequest::HostInitialState));

        let finalize_request = serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_finalize_initialization",
            "baseDirectory": "/tmp/kaede",
            "folders": ["assets", "libraries/natives"],
            "javaBinary": "java"
        }))
        .expect("finalization request should deserialize");
        assert!(matches!(
            finalize_request,
            BrokerRequest::HostFinalizeInitialization {
                base_directory,
                folders,
                java_binary,
            } if base_directory == "/tmp/kaede"
                && folders == vec!["assets", "libraries/natives"]
                && java_binary == "java"
        ));

        let initial_response = BrokerResponse::InitialState {
            state: launcher::InitialState {
                basic: launcher::InitialStateBasic {
                    launcher_version: "1.2.3".to_owned(),
                    base_directory: "/tmp/kaede".to_owned(),
                    launch_count: 4,
                    separator: "/".to_owned(),
                    portable: true,
                },
                parsed: launcher::InitialStateParsedFiles {
                    config: launcher::ParsedFile::Loaded {
                        data: serde_json::json!({ "locale": "en" }),
                    },
                    accounts: launcher::ParsedFile::Missing,
                    instances: launcher::ParsedFile::Corrupt {
                        raw: "{".to_owned(),
                        error: "expected object key".to_owned(),
                    },
                    translations: launcher::ParsedFile::Missing,
                },
            },
        };
        assert_eq!(
            serde_json::to_value(initial_response)
                .expect("initial-state response should serialize"),
            serde_json::json!({
                "kind": "initial_state",
                "state": {
                    "basic": {
                        "launcherVersion": "1.2.3",
                        "baseDirectory": "/tmp/kaede",
                        "launchCount": 4,
                        "separator": "/",
                        "portable": true
                    },
                    "parsed": {
                        "config": { "status": "loaded", "data": { "locale": "en" } },
                        "accounts": { "status": "missing" },
                        "instances": {
                            "status": "corrupt",
                            "raw": "{",
                            "error": "expected object key"
                        },
                        "translations": { "status": "missing" }
                    }
                }
            })
        );

        let finalization_response = BrokerResponse::InitializationFinalized {
            report: finalization::LauncherInitReport {
                created_directories: vec!["/tmp/kaede/assets".to_owned()],
                java_major: None,
                java_major_source: "unresolved",
            },
        };
        assert_eq!(
            serde_json::to_value(finalization_response)
                .expect("finalization response should serialize"),
            serde_json::json!({
                "kind": "initialization_finalized",
                "report": {
                    "createdDirectories": ["/tmp/kaede/assets"],
                    "javaMajor": null,
                    "javaMajorSource": "unresolved"
                }
            })
        );
    }

    #[test]
    fn extension_read_request_has_no_caller_controlled_path_and_response_is_typed() {
        let request = serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_read_extensions"
        }))
        .expect("extension read request should deserialize");
        assert!(matches!(request, BrokerRequest::HostReadExtensions {}));

        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_read_extensions",
            "path": "/tmp/attacker-controlled"
        }))
        .is_err());

        let response = BrokerResponse::ExtensionsRead {
            result: extensions::ExtensionsReadResult {
                extensions: vec![extensions::ExtensionFile {
                    file_name: "sample.kaede".to_owned(),
                    metadata: serde_json::json!({ "id": "sample" }),
                    code: "void 0".to_owned(),
                    artifact_sha256:
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                            .to_owned(),
                }],
                failures: vec![extensions::ExtensionFailure {
                    file_name: "broken.zip".to_owned(),
                    error: "invalid zip".to_owned(),
                }],
            },
        };
        assert_eq!(
            serde_json::to_value(response).expect("extension read response should serialize"),
            serde_json::json!({
                "kind": "extensions_read",
                "result": {
                    "extensions": [{
                        "fileName": "sample.kaede",
                        "metadata": { "id": "sample" },
                        "code": "void 0",
                        "artifactSha256":
                            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    }],
                    "failures": [{
                        "fileName": "broken.zip",
                        "error": "invalid zip"
                    }]
                }
            })
        );
    }

    #[test]
    fn host_diagnostics_and_file_metadata_use_typed_broker_dtos() {
        assert!(matches!(
            serde_json::from_value::<BrokerRequest>(serde_json::json!({
                "kind": "host_system_memory"
            }))
            .expect("system-memory request should deserialize"),
            BrokerRequest::HostSystemMemory
        ));
        assert!(matches!(
            serde_json::from_value::<BrokerRequest>(serde_json::json!({
                "kind": "host_global_cpu_usage"
            }))
            .expect("global-CPU request should deserialize"),
            BrokerRequest::HostGlobalCpuUsage
        ));
        assert!(matches!(
            serde_json::from_value::<BrokerRequest>(serde_json::json!({
                "kind": "host_hash_sha256",
                "bytes": [0, 127, 128, 255]
            }))
            .expect("SHA-256 request should deserialize"),
            BrokerRequest::HostHashSha256 { bytes }
                if bytes == vec![0, 127, 128, 255]
        ));
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_hash_md5",
            "bytes": [256]
        }))
        .is_err());
        assert!(matches!(
            serde_json::from_value::<BrokerRequest>(serde_json::json!({
                "kind": "host_fs_metadata",
                "path": "/tmp/cache.json",
                "baseDirectory": null
            }))
            .expect("file-metadata request should deserialize"),
            BrokerRequest::HostFsMetadata { path, base_directory }
                if path == Path::new("/tmp/cache.json") && base_directory.is_none()
        ));
        assert!(serde_json::from_value::<BrokerRequest>(serde_json::json!({
            "kind": "host_fs_metadata",
            "path": "/tmp/cache.json",
            "baseDirectory": null,
            "command": "get_system_memory"
        }))
        .is_err());

        assert_eq!(
            serde_json::to_value(BrokerResponse::SystemMemory {
                used_bytes: 4_294_967_296,
                total_bytes: 8_589_934_592,
            })
            .expect("system-memory response should serialize"),
            serde_json::json!({
                "kind": "system_memory",
                "usedBytes": 4_294_967_296_u64,
                "totalBytes": 8_589_934_592_u64
            })
        );
        assert_eq!(
            serde_json::to_value(BrokerResponse::GlobalCpuUsage { usage: 12.5 })
                .expect("global-CPU response should serialize"),
            serde_json::json!({ "kind": "global_cpu_usage", "usage": 12.5 })
        );
        assert_eq!(
            serde_json::to_value(BrokerResponse::FileMetadata {
                modified_time_milliseconds: Some(1_753_488_000_000),
            })
            .expect("file-metadata response should serialize"),
            serde_json::json!({
                "kind": "file_metadata",
                "modifiedTimeMilliseconds": 1_753_488_000_000_u64
            })
        );
        assert_eq!(
            serde_json::to_value(BrokerResponse::FileMetadata {
                modified_time_milliseconds: None,
            })
            .expect("unavailable file mtime should serialize"),
            serde_json::json!({
                "kind": "file_metadata",
                "modifiedTimeMilliseconds": null
            })
        );
    }

    #[tokio::test]
    async fn host_diagnostics_and_file_metadata_reject_plugin_sessions_at_dispatch() {
        let (state, host, plugin, temp_root, _principal_root) =
            storage_test_context("host-diagnostics-metadata", false);
        let metadata_path = temp_root.join("cache.json");
        std::fs::write(&metadata_path, b"{}").expect("file-metadata fixture should be written");
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");

        for (request, operation) in [
            (BrokerRequest::HostSystemMemory, "system memory"),
            (BrokerRequest::HostGlobalCpuUsage, "global CPU usage"),
            (
                BrokerRequest::HostHashMd5 {
                    bytes: b"plugin".to_vec(),
                },
                "MD5 hashing",
            ),
            (
                BrokerRequest::HostHashSha256 {
                    bytes: b"plugin".to_vec(),
                },
                "SHA-256 hashing",
            ),
            (
                BrokerRequest::HostFsMetadata {
                    path: temp_root.join("plugin-must-not-probe.json"),
                    base_directory: None,
                },
                "file metadata",
            ),
        ] {
            let error = dispatch(app.handle(), &state, &plugin, request, None)
                .await
                .expect_err(&format!("plugin session must not access host {operation}"));
            assert!(matches!(
                error,
                CommandError::Unauthorized { ref message }
                    if message == &AuthorizationError::HostSessionRequired.to_string()
            ));
        }

        let memory = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostSystemMemory,
            None,
        )
        .await
        .expect("host session should read system memory");
        assert!(matches!(
            memory,
            BrokerResponse::SystemMemory {
                used_bytes,
                total_bytes,
            } if total_bytes > 0 && used_bytes <= total_bytes
        ));

        let cpu = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostGlobalCpuUsage,
            None,
        )
        .await
        .expect("host session should read global CPU usage");
        assert!(matches!(
            cpu,
            BrokerResponse::GlobalCpuUsage { usage } if usage.is_finite() && usage >= 0.0
        ));

        let md5 = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostHashMd5 { bytes: Vec::new() },
            None,
        )
        .await
        .expect("host session should compute MD5");
        assert!(matches!(
            md5,
            BrokerResponse::Text { text }
                if text == "d41d8cd98f00b204e9800998ecf8427e"
        ));

        let sha256 = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostHashSha256 { bytes: Vec::new() },
            None,
        )
        .await
        .expect("host session should compute SHA-256");
        assert!(matches!(
            sha256,
            BrokerResponse::Text { text }
                if text
                    == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        ));

        let metadata = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostFsMetadata {
                path: metadata_path.clone(),
                base_directory: None,
            },
            None,
        )
        .await
        .expect("host session should read file metadata");
        let expected_modified = std::fs::metadata(&metadata_path)
            .expect("file-metadata fixture should exist")
            .modified()
            .ok()
            .map(system_time_to_milliseconds);
        assert!(matches!(
            metadata,
            BrokerResponse::FileMetadata {
                modified_time_milliseconds,
            } if modified_time_milliseconds == expected_modified
        ));

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[tokio::test]
    async fn extension_read_is_host_only_and_uses_the_runtime_extensions_directory() {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let root = std::env::temp_dir().join(format!("kaede-broker-extensions-{suffix}"));
        let extensions_dir = root.join("extensions");
        std::fs::create_dir_all(&extensions_dir).expect("extensions directory should exist");
        std::fs::write(extensions_dir.join("derived.kaede"), b"not a zip")
            .expect("invalid archive fixture should be written");
        let state = BrokerState::new_for_runtime(launcher::RuntimePaths {
            portable: false,
            base_directory: root.clone(),
            executable_directory: root.join("bin"),
            app_data_directory: root.clone(),
        })
        .expect("runtime broker state should initialize");
        let host = bootstrap_state(&state)
            .expect("host should bootstrap")
            .session;
        let plugin = SessionToken::new("extension-reader-plugin");
        {
            let mut authorizer = lock_authorizer(&state);
            authorizer
                .open_plugin(
                    &host,
                    plugin.clone(),
                    Principal::new(
                        "https://plugins.example.test/owner/extension-reader",
                        "extension.reader",
                        "1.0.0",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                )
                .expect("plugin session should open");
        }
        state.operations.register(plugin.clone());
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");

        let denied = dispatch(
            app.handle(),
            &state,
            &plugin,
            BrokerRequest::HostReadExtensions {},
            None,
        )
        .await
        .expect_err("plugin session must not read installed extension archives");
        assert!(matches!(
            denied,
            CommandError::Unauthorized { ref message }
                if message == &AuthorizationError::HostSessionRequired.to_string()
        ));

        let response = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostReadExtensions {},
            None,
        )
        .await
        .expect("host should read the derived extensions directory");
        assert!(matches!(
            response,
            BrokerResponse::ExtensionsRead { result }
                if result.extensions.is_empty()
                    && result.failures.len() == 1
                    && result.failures[0].file_name == "derived.kaede"
        ));

        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn initialization_operations_are_host_only_at_dispatch() {
        let (state, host, plugin, temp_root, _principal_root) =
            storage_test_context("host-initialization", false);
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");

        let initial_error = dispatch(
            app.handle(),
            &state,
            &plugin,
            BrokerRequest::HostInitialState,
            None,
        )
        .await
        .expect_err("plugin session must not load host initialization state");
        assert!(matches!(
            initial_error,
            CommandError::Unauthorized { ref message }
                if message == &AuthorizationError::HostSessionRequired.to_string()
        ));

        let denied_base = temp_root.join("plugin-denied-finalization");
        let finalization_error = dispatch(
            app.handle(),
            &state,
            &plugin,
            BrokerRequest::HostFinalizeInitialization {
                base_directory: denied_base.to_string_lossy().into_owned(),
                folders: vec!["must-not-exist".to_owned()],
                java_binary: "__kaede_missing_java_for_broker_test__".to_owned(),
            },
            None,
        )
        .await
        .expect_err("plugin session must not finalize host initialization");
        assert!(matches!(
            finalization_error,
            CommandError::Unauthorized { ref message }
                if message == &AuthorizationError::HostSessionRequired.to_string()
        ));
        assert!(!denied_base.exists());

        let initial_response = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostInitialState,
            None,
        )
        .await
        .expect("host session should load initialization state");
        let initial_json =
            serde_json::to_value(initial_response).expect("initial state should serialize");
        assert_eq!(initial_json["kind"], "initial_state");
        assert!(initial_json["state"]["basic"]["launchCount"].is_number());
        assert!(initial_json["state"]["parsed"].is_object());

        let finalization_base = temp_root.join("host-finalization");
        let finalization_response = dispatch(
            app.handle(),
            &state,
            &host,
            BrokerRequest::HostFinalizeInitialization {
                base_directory: finalization_base.to_string_lossy().into_owned(),
                folders: vec!["assets".to_owned(), "libraries/natives".to_owned()],
                java_binary: "__kaede_missing_java_for_broker_test__".to_owned(),
            },
            None,
        )
        .await
        .expect("host session should finalize initialization");
        let finalization_json = serde_json::to_value(finalization_response)
            .expect("finalization response should serialize");
        assert_eq!(finalization_json["kind"], "initialization_finalized");
        assert_eq!(finalization_json["report"]["javaMajorSource"], "unresolved");
        assert!(finalization_base.join("assets").is_dir());
        assert!(finalization_base.join("libraries/natives").is_dir());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[tokio::test]
    async fn launch_count_advances_once_per_completed_page_bootstrap() {
        let state = broker_test_state("launch-count");
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");

        crate::plugin_broker::reset_state_for_page_load(&state);
        let first = bootstrap_state(&state).expect("first page should bootstrap");
        for _ in 0..2 {
            let snapshot = dispatch(
                app.handle(),
                &state,
                &first.session,
                BrokerRequest::HostRuntimeSnapshot,
                None,
            )
            .await
            .expect("first-page runtime snapshot should load");
            assert!(matches!(
                snapshot,
                BrokerResponse::RuntimeSnapshot {
                    launch_count: 0,
                    ..
                }
            ));

            let initial = dispatch(
                app.handle(),
                &state,
                &first.session,
                BrokerRequest::HostInitialState,
                None,
            )
            .await
            .expect("first-page initialization state should load");
            assert!(matches!(
                initial,
                BrokerResponse::InitialState {
                    state: launcher::InitialState {
                        basic: launcher::InitialStateBasic {
                            launch_count: 0,
                            ..
                        },
                        ..
                    }
                }
            ));
        }

        crate::plugin_broker::reset_state_for_page_load(&state);
        assert_eq!(state.launch_count(), 1);
        let stale_error = dispatch(
            app.handle(),
            &state,
            &first.session,
            BrokerRequest::HostRuntimeSnapshot,
            None,
        )
        .await
        .expect_err("the prior page session should be stale");
        assert!(matches!(stale_error, CommandError::Unauthorized { .. }));
        assert_eq!(state.launch_count(), 1);

        crate::plugin_broker::reset_state_for_page_load(&state);
        assert_eq!(
            state.launch_count(),
            1,
            "a duplicate reset without a completed bootstrap must not count as another launch"
        );

        let second = bootstrap_state(&state).expect("next page should bootstrap");
        let second_snapshot = dispatch(
            app.handle(),
            &state,
            &second.session,
            BrokerRequest::HostRuntimeSnapshot,
            None,
        )
        .await
        .expect("next-page runtime snapshot should load");
        assert!(matches!(
            second_snapshot,
            BrokerResponse::RuntimeSnapshot {
                launch_count: 1,
                ..
            }
        ));
        let second_initial = dispatch(
            app.handle(),
            &state,
            &second.session,
            BrokerRequest::HostInitialState,
            None,
        )
        .await
        .expect("next-page initialization state should load");
        assert!(matches!(
            second_initial,
            BrokerResponse::InitialState {
                state: launcher::InitialState {
                    basic: launcher::InitialStateBasic {
                        launch_count: 1,
                        ..
                    },
                    ..
                }
            }
        ));
    }

    #[test]
    fn broker_request_rejects_privileged_kinds_absent_from_the_frontend_contract() {
        for kind in [
            "host_fs_copy",
            "host_process_execute",
            "host_process_spawn",
            "launch_count",
            "executable_directory",
            "app_data_directory",
            "system_memory",
            "process_memory",
            "plugin_fs_exists",
            "plugin_fs_read_dir",
            "plugin_fs_mkdir",
            "plugin_fs_copy",
            "plugin_fs_rename",
            "os_info",
            "dialog_open",
            "opener_open_url",
            "plugin_http_download",
            "plugin_process_execute",
            "process_write",
            "shell_spawn",
        ] {
            let error = serde_json::from_value::<BrokerRequest>(serde_json::json!({
                "kind": kind
            }))
            .expect_err("Rust must not deserialize a request kind absent from TypeScript");
            assert!(
                error.to_string().contains("unknown variant"),
                "{kind} unexpectedly remained a known request variant: {error}"
            );
        }
    }

    #[test]
    fn bootstrap_is_one_shot_per_page_and_reset_requires_a_higher_generation() {
        let state = broker_test_state("bootstrap");
        let first = bootstrap_state(&state).expect("first page bootstrap should succeed");
        assert_eq!(first.generation, 0);

        assert!(matches!(
            bootstrap_state(&state),
            Err(CommandError::Unauthorized { message })
                if message == AuthorizationError::HostAlreadyBootstrapped.to_string()
        ));

        let plugin = SessionToken::new("page-plugin");
        {
            let mut authorizer = lock_authorizer(&state);
            authorizer
                .open_plugin(
                    &first.session,
                    plugin.clone(),
                    Principal::new(
                        "https://plugins.example.test/owner/example",
                        "example.plugin",
                        "1.0.0",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                )
                .expect("plugin should open in the first page generation");
        }

        crate::plugin_broker::reset_state_for_page_load(&state);
        {
            let authorizer = lock_authorizer(&state);
            assert!(
                authorizer
                    .host_session(&first.session)
                    .expect("old host history should remain")
                    .revoked
            );
            assert!(
                authorizer
                    .plugin_session(&plugin)
                    .expect("old plugin history should remain")
                    .revoked
            );
        }

        let second = bootstrap_state(&state).expect("next page bootstrap should succeed");
        assert_eq!(second.generation, first.generation + 1);
        assert_ne!(second.session, first.session);
        assert!(matches!(
            lock_authorizer(&state).open_plugin(
                &first.session,
                SessionToken::new("late-plugin"),
                Principal::new(
                    "https://plugins.example.test/owner/example",
                    "late.plugin",
                    "1.0.0",
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                ),
            ),
            Err(AuthorizationError::SessionRevoked)
        ));
    }

    #[test]
    fn host_exists_probes_accept_multiple_missing_descendants_within_the_base() {
        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("host-exists-missing-descendants", false);
        let base = temp_root.join("host-base");
        std::fs::create_dir_all(&base).expect("host base should exist");
        let requested = [
            Path::new("missing-directory"),
            Path::new("missing-directory/nested/missing-file.json"),
        ];

        let exists = requested
            .iter()
            .map(|path| {
                resolve_storage_path(&state, &host, path, Some(&base), StorageAccess::Read, false)
                    .map(|resolved| resolved.exists())
            })
            .collect::<Result<Vec<_>, _>>()
            .expect("valid missing paths should resolve for existence probes");

        assert_eq!(exists, vec![false, false]);
        let absolute_exists = requested
            .iter()
            .map(|path| {
                resolve_storage_path(
                    &state,
                    &host,
                    &base.join(path),
                    None,
                    StorageAccess::Read,
                    false,
                )
                .map(|resolved| resolved.exists())
            })
            .collect::<Result<Vec<_>, _>>()
            .expect("valid absolute missing paths should resolve for existence probes");
        assert_eq!(absolute_exists, vec![false, false]);
        assert!(resolve_storage_path(
            &state,
            &host,
            Path::new("../escape"),
            Some(&base),
            StorageAccess::Read,
            false,
        )
        .is_err());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(unix)]
    #[test]
    fn host_base_resolution_rejects_a_dangling_symlink_escape() {
        use std::os::unix::fs::symlink;

        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("host-dangling-symlink", false);
        let base = temp_root.join("host-base");
        let outside = temp_root.join("outside");
        std::fs::create_dir_all(&base).expect("host base should exist");
        std::fs::create_dir_all(&outside).expect("outside directory should exist");
        let outside_target = outside.join("new-file.txt");
        symlink(&outside_target, base.join("escape.txt"))
            .expect("dangling escape symlink should be created");

        let result = resolve_storage_path(
            &state,
            &host,
            Path::new("escape.txt"),
            Some(&base),
            StorageAccess::Write,
            false,
        );

        assert!(result.is_err());
        assert!(!outside_target.exists());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn plugin_binary_write_and_remove_use_the_internal_write_grant() {
        let (state, _host, plugin, temp_root, principal_root) =
            storage_test_context("write-remove", true);
        let relative_path = Path::new("payload.bin");

        plugin_fs_write_bytes(&state, &plugin, relative_path, &[0, 127, 255])
            .expect("granted binary write should succeed");
        assert_eq!(
            plugin_fs_read_bytes(&state, &plugin, relative_path)
                .expect("granted binary read should succeed"),
            vec![0, 127, 255]
        );
        plugin_fs_write_text(&state, &plugin, relative_path, "replacement")
            .expect("granted text write should succeed");
        assert_eq!(
            plugin_fs_read_text(&state, &plugin, relative_path)
                .expect("granted text read should succeed"),
            "replacement"
        );
        plugin_fs_remove(&state, &plugin, relative_path).expect("granted remove should succeed");
        assert!(!principal_root.join(relative_path).exists());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn plugin_binary_write_and_remove_are_denied_without_the_write_grant() {
        let (state, _host, plugin, temp_root, principal_root) =
            storage_test_context("write-remove-denied", false);
        let relative_path = Path::new("payload.bin");
        let absolute_path = principal_root.join(relative_path);

        assert!(plugin_fs_write_bytes(&state, &plugin, relative_path, b"denied").is_err());
        assert!(!absolute_path.exists());
        std::fs::create_dir_all(&principal_root).expect("fixture root should exist");
        std::fs::write(&absolute_path, b"fixture").expect("fixture should be created directly");
        assert!(plugin_fs_remove(&state, &plugin, relative_path).is_err());
        assert_eq!(
            std::fs::read(&absolute_path).expect("denied remove must preserve the file"),
            b"fixture"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn plugin_binary_write_and_remove_observe_revocation() {
        let (state, host, plugin, temp_root, principal_root) =
            storage_test_context("write-remove-revoked", true);
        let relative_path = Path::new("payload.bin");
        let absolute_path = principal_root.join(relative_path);
        plugin_fs_write_bytes(&state, &plugin, relative_path, b"before-revocation")
            .expect("write should succeed before revocation");
        lock_authorizer(&state)
            .revoke_plugin(&host, &plugin)
            .expect("plugin should revoke");

        assert!(plugin_fs_write_bytes(&state, &plugin, relative_path, b"after").is_err());
        assert!(plugin_fs_remove(&state, &plugin, relative_path).is_err());
        assert_eq!(
            std::fs::read(&absolute_path).expect("revocation must preserve the prior payload"),
            b"before-revocation"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(unix)]
    #[test]
    fn plugin_remove_unlinks_internal_symlink_without_touching_its_target() {
        use std::os::unix::fs::symlink;

        let (state, _host, plugin, temp_root, principal_root) =
            storage_test_context("write-remove-symlink", true);
        let outside = temp_root.join("outside.bin");
        std::fs::write(&outside, b"outside").expect("outside fixture should be created");
        let relative_link = Path::new("escape.bin");
        symlink(&outside, principal_root.join(relative_link))
            .expect("escape symlink should be created");

        assert!(plugin_fs_write_bytes(&state, &plugin, relative_link, b"overwritten").is_err());
        plugin_fs_remove(&state, &plugin, relative_link)
            .expect("portable remove should unlink the symlink itself");
        assert!(!principal_root.join(relative_link).exists());
        assert_eq!(
            std::fs::read(&outside).expect("outside fixture should remain readable"),
            b"outside"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(unix)]
    #[test]
    fn plugin_storage_handle_blocks_ancestor_swap_after_authorization() {
        use std::os::unix::fs::symlink;
        use std::sync::{Arc, Barrier};

        let (state, _host, plugin, temp_root, principal_root) =
            storage_test_context("write-ancestor-race", true);
        let authorized_directory = principal_root.join("authorized");
        std::fs::create_dir(&authorized_directory).expect("authorized directory should be created");
        std::fs::write(authorized_directory.join("payload.bin"), b"inside")
            .expect("inside fixture should be created");
        let outside_directory = temp_root.join("outside");
        std::fs::create_dir(&outside_directory).expect("outside directory should be created");
        let outside_payload = outside_directory.join("payload.bin");
        std::fs::write(&outside_payload, b"outside").expect("outside fixture should be created");

        let target = resolve_plugin_storage_target(
            &state,
            &plugin,
            Path::new("authorized/payload.bin"),
            StorageAccess::Write,
            true,
        )
        .expect("path should authorize before the race barrier");
        let barrier = Arc::new(Barrier::new(2));
        let attacker_barrier = Arc::clone(&barrier);
        let attacker_root = principal_root.clone();
        let attacker_outside = outside_directory.clone();
        let attacker = std::thread::spawn(move || {
            attacker_barrier.wait();
            std::fs::rename(
                attacker_root.join("authorized"),
                attacker_root.join("authorized-original"),
            )
            .expect("authorized ancestor should be swapped out");
            symlink(&attacker_outside, attacker_root.join("authorized"))
                .expect("outside ancestor symlink should be installed");
            attacker_barrier.wait();
        });
        barrier.wait();
        barrier.wait();

        let result = target
            .directory
            .write(&target.relative_path, b"attacker-controlled");
        attacker.join().expect("attacker thread should finish");
        assert!(result.is_err());
        assert_eq!(
            std::fs::read(&outside_payload).expect("outside payload should remain readable"),
            b"outside"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn redirect_method_semantics_match_fetch_redirect_rules() {
        assert_eq!(
            redirected_method(reqwest::StatusCode::SEE_OTHER, &method("PUT"))
                .expect("method should map")
                .as_str(),
            "GET"
        );
        assert_eq!(
            redirected_method(reqwest::StatusCode::FOUND, &method("POST"))
                .expect("method should map")
                .as_str(),
            "GET"
        );
        assert_eq!(
            redirected_method(reqwest::StatusCode::FOUND, &method("PUT"))
                .expect("method should remain")
                .as_str(),
            "PUT"
        );
        assert_eq!(
            redirected_method(reqwest::StatusCode::TEMPORARY_REDIRECT, &method("POST"))
                .expect("method should remain")
                .as_str(),
            "POST"
        );
    }

    #[test]
    fn fetch_redirect_statuses_exclude_not_modified() {
        for status in [301, 302, 303, 307, 308] {
            assert!(is_fetch_redirect_status(
                reqwest::StatusCode::from_u16(status).expect("status should be valid")
            ));
        }
        assert!(!is_fetch_redirect_status(reqwest::StatusCode::NOT_MODIFIED));
    }

    #[tokio::test]
    async fn collected_http_response_preserves_final_redirect_metadata() {
        let response = local_http_response(200).await;
        let final_url =
            reqwest::Url::parse("https://example.test/final").expect("final URL should parse");
        let response = collect_http_response(response, final_url.clone(), true)
            .await
            .expect("HTTP response should be collected");
        let serialized =
            serde_json::to_value(&response).expect("HTTP response metadata should serialize");

        assert_eq!(response.url, final_url.as_str());
        assert!(response.redirected);
        assert_eq!(serialized["url"], final_url.as_str());
        assert_eq!(serialized["redirected"], true);
    }

    #[tokio::test]
    async fn non_fetch_http_status_is_rejected_before_serialization() {
        let response = local_http_response(101).await;
        let final_url = response.url().clone();
        let error = collect_http_response(response, final_url, false)
            .await
            .expect_err("101 response should be rejected");

        assert!(matches!(
            error,
            CommandError::OperationFailed {
                operation: "http_response_status",
                ref message,
            } if message.contains("101")
        ));
    }

    #[tokio::test]
    async fn failed_http_download_statuses_do_not_create_or_replace_the_destination() {
        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("http-download-status", false);
        let download_directory = temp_root.join("downloads");
        std::fs::create_dir_all(&download_directory).expect("download directory should exist");
        let destination = download_directory.join("artifact.bin");

        let response = local_http_response(404).await;
        let pending = PendingHttpResponse {
            url: response.url().clone(),
            response,
            method: method("GET"),
            plugin: false,
            redirected: false,
        };
        let error = write_http_download(&state, &host, pending, destination.clone(), None)
            .await
            .expect_err("404 download should be rejected");
        assert!(matches!(
            error,
            CommandError::OperationFailed {
                operation: "http_download_status",
                ref message,
            } if message.contains("404")
        ));
        assert!(!destination.exists());

        std::fs::write(&destination, b"existing artifact")
            .expect("existing destination should be created");
        let response = local_http_response(500).await;
        let pending = PendingHttpResponse {
            url: response.url().clone(),
            response,
            method: method("GET"),
            plugin: false,
            redirected: false,
        };
        let error = write_http_download(&state, &host, pending, destination.clone(), None)
            .await
            .expect_err("500 download should be rejected");
        assert!(matches!(
            error,
            CommandError::OperationFailed {
                operation: "http_download_status",
                ref message,
            } if message.contains("500")
        ));
        assert_eq!(
            std::fs::read(&destination).expect("existing destination should remain readable"),
            b"existing artifact"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[tokio::test]
    async fn page_reset_interrupts_stalled_batch_and_cleans_partial_without_failure() {
        use tauri::ipc::InvokeResponseBody;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("batch-download-cancel", false);
        let download_directory = temp_root.join("downloads");
        std::fs::create_dir_all(&download_directory).expect("download directory should exist");
        let destination = download_directory.join("artifact.bin");
        std::fs::write(&destination, b"existing artifact")
            .expect("existing destination should be created");

        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("local HTTP listener should bind");
        let address = listener
            .local_addr()
            .expect("local HTTP address should be available");
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("local HTTP request should connect");
            let mut request = [0_u8; 4096];
            let _ = stream
                .read(&mut request)
                .await
                .expect("local HTTP request should be readable");
            stream
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 1000000\r\nConnection: keep-alive\r\n\r\npartial",
                )
                .await
                .expect("partial local response should be written");
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        });

        let emitted = Arc::new(Mutex::new(Vec::new()));
        let captured = Arc::clone(&emitted);
        let events = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("download events should use JSON channel payloads");
            };
            captured
                .lock()
                .expect("captured progress should lock")
                .push(serde_json::from_str::<serde_json::Value>(&json)?);
            Ok(())
        });
        let entries = vec![DownloadEntry {
            url: format!("http://{address}/artifact.bin"),
            path: destination.clone(),
        }];
        let batch = download_batch(
            &state,
            &host,
            DownloadBatchOptions {
                generation: 1,
                entries,
                concurrency: 0,
                label: "test batch".to_owned(),
                cancel_id: "launch".to_owned(),
                events: Some(events),
            },
        );
        let cancellation = async {
            for _ in 0..400 {
                let partial_exists = std::fs::read_dir(&download_directory)
                    .expect("download directory should remain readable")
                    .filter_map(Result::ok)
                    .any(|entry| entry.file_name().to_string_lossy().ends_with(".part"));
                if partial_exists {
                    crate::plugin_broker::reset_state_for_page_load(&state);
                    return;
                }
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            }
            panic!("download should create its partial before page reset");
        };
        let (report, ()) = tokio::join!(batch, cancellation);
        server.abort();

        assert!(report.cancelled);
        assert_eq!(report.success, 0);
        assert_eq!(report.failed, 0);
        assert!(report.failures.is_empty());
        assert_eq!(
            std::fs::read(&destination).expect("existing destination should remain readable"),
            b"existing artifact"
        );
        assert!(std::fs::read_dir(&download_directory)
            .expect("download directory should remain readable")
            .filter_map(Result::ok)
            .all(|entry| !entry.file_name().to_string_lossy().ends_with(".part")));
        let events = emitted.lock().expect("captured progress should lock");
        let terminal = events.last().expect("terminal progress should be emitted");
        assert_eq!(terminal["kind"], "download_batch_progress");
        assert_eq!(terminal["current"], serde_json::json!({}));
        assert_eq!(terminal["success"], 0);
        assert_eq!(terminal["failed"], 0);

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[tokio::test]
    async fn revoked_generation_stops_batch_preparation_without_recording_failures() {
        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("batch-download-preparation-cancel", false);
        state.downloads.cancel_generation(1);

        let report = download_batch(
            &state,
            &host,
            DownloadBatchOptions {
                generation: 1,
                entries: vec![DownloadEntry {
                    url: "https://example.test/never-requested".to_owned(),
                    path: PathBuf::from("invalid-relative-destination"),
                }],
                concurrency: 1,
                label: "test batch".to_owned(),
                cancel_id: "launch".to_owned(),
                events: None,
            },
        )
        .await;

        assert!(report.cancelled);
        assert_eq!(report.success, 0);
        assert_eq!(report.failed, 0);
        assert!(report.failures.is_empty());
        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[tokio::test]
    async fn not_modified_download_with_location_is_not_followed_and_preserves_destination() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("local HTTP listener should bind");
        let address = listener
            .local_addr()
            .expect("local HTTP address should be available");
        let server = tokio::spawn(async move {
            let mut requested_targets = Vec::new();
            for request_index in 0..2 {
                let accepted = if request_index == 0 {
                    Some(
                        listener
                            .accept()
                            .await
                            .expect("initial HTTP request should connect"),
                    )
                } else {
                    tokio::time::timeout(std::time::Duration::from_millis(250), listener.accept())
                        .await
                        .ok()
                        .map(|result| result.expect("follow-up HTTP request should connect"))
                };
                let Some((mut stream, _)) = accepted else {
                    break;
                };
                let mut request = [0_u8; 4096];
                let request_length = stream
                    .read(&mut request)
                    .await
                    .expect("local HTTP request should be readable");
                let request = String::from_utf8_lossy(&request[..request_length]);
                let target = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .expect("request target should be present");
                requested_targets.push(target.to_owned());

                let response = if request_index == 0 {
                    "HTTP/1.1 304 Not Modified\r\nLocation: /followed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                } else {
                    "HTTP/1.1 200 OK\r\nContent-Length: 11\r\nConnection: close\r\n\r\nreplacement"
                };
                stream
                    .write_all(response.as_bytes())
                    .await
                    .expect("local HTTP response should be written");
            }
            requested_targets
        });

        let (state, host, _plugin, temp_root, _principal_root) =
            storage_test_context("http-download-304", false);
        let download_directory = temp_root.join("downloads");
        std::fs::create_dir_all(&download_directory).expect("download directory should exist");
        let destination = download_directory.join("artifact.bin");
        std::fs::write(&destination, b"existing artifact")
            .expect("existing destination should be created");

        let error = download_http(
            &state,
            &host,
            HttpRequest {
                url: format!("http://{address}/artifact"),
                method: method("GET"),
                headers: Vec::new(),
                body: None,
            },
            destination.clone(),
            None,
        )
        .await
        .expect_err("304 download should be rejected without following Location");
        assert!(matches!(
            error,
            CommandError::OperationFailed {
                operation: "http_download_status",
                ref message,
            } if message.contains("304")
        ));
        assert_eq!(
            server.await.expect("local HTTP server should finish"),
            vec!["/artifact"]
        );
        assert_eq!(
            std::fs::read(&destination).expect("existing destination should remain readable"),
            b"existing artifact"
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn local_address_classifier_rejects_private_loopback_and_link_local() {
        for address in [
            "127.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "169.254.1.1",
            "192.0.2.1",
            "198.18.0.1",
            "240.0.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "64:ff9b::7f00:1",
            "64:ff9b:1::1",
            "100::1",
            "2001:db8::1",
            "fe80::1",
            "fec0::1",
        ] {
            assert!(is_local_address(
                address.parse().expect("fixture address should parse")
            ));
        }
        for address in ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"] {
            assert!(!is_local_address(
                address.parse().expect("fixture address should parse")
            ));
        }
        assert_eq!(unbracketed_host("[::1]"), "::1");
        assert_eq!(unbracketed_host("example.com"), "example.com");
    }

    #[test]
    fn relative_storage_path_rejects_traversal_and_absolute_paths() {
        assert!(validate_relative_plugin_path(Path::new("folder/file.txt")).is_ok());
        assert!(validate_relative_plugin_path(Path::new("../escape")).is_err());
        assert!(validate_relative_plugin_path(Path::new("/absolute")).is_err());
    }

    #[test]
    fn plugin_process_exact_grant_rejects_cwd_and_environment() {
        let empty = BTreeMap::new();
        assert!(validate_plugin_process_options(None, &empty).is_ok());
        assert!(validate_plugin_process_options(Some(Path::new("work")), &empty).is_err());
        let environment = BTreeMap::from([("LD_PRELOAD".to_owned(), "/tmp/inject.so".to_owned())]);
        assert!(validate_plugin_process_options(None, &environment).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn external_symlink_preparation_is_stable_until_the_target_changes() {
        use std::os::unix::fs::symlink;

        let (state, _host, _plugin, temp_root, _principal_root) =
            storage_test_context("external-grant-identity", false);
        let external_root = temp_root
            .parent()
            .expect("test root should have a parent")
            .join(format!(
                "{}-external",
                temp_root
                    .file_name()
                    .expect("test root should have a file name")
                    .to_string_lossy()
            ));
        let target_a = external_root.join("storage-a");
        let target_b = external_root.join("storage-b");
        let link = external_root.join("storage-link");
        std::fs::create_dir_all(&target_a).expect("first storage target should exist");
        std::fs::create_dir_all(&target_b).expect("second storage target should exist");
        symlink(&target_a, &link).expect("storage symlink should be created");
        let descriptor = || {
            PermissionDescriptor::Structured(StructuredPermissionDescriptor::StorageExternalRead {
                scope: ExternalDescriptorScope {
                    roots: vec![link.clone()],
                },
            })
        };

        let first = prepare_permission_descriptor(&state, descriptor())
            .expect("first target should prepare");
        let unchanged = prepare_permission_descriptor(&state, descriptor())
            .expect("unchanged target should prepare");
        assert_eq!(first.target_identities.len(), 1);
        assert_eq!(unchanged.target_identities.len(), 1);
        assert_eq!(first.target_identities[0].path, target_a);
        assert_eq!(
            first.target_identities[0].device,
            unchanged.target_identities[0].device
        );
        assert_eq!(
            first.target_identities[0].inode,
            unchanged.target_identities[0].inode
        );

        std::fs::remove_file(&link).expect("old storage symlink should be removed");
        symlink(&target_b, &link).expect("storage symlink should be retargeted");
        let retargeted = prepare_permission_descriptor(&state, descriptor())
            .expect("retargeted storage should prepare");
        assert_eq!(retargeted.target_identities[0].path, target_b);
        assert_ne!(
            first.target_identities[0].inode,
            retargeted.target_identities[0].inode
        );

        let principal = Principal::new(
            "https://plugins.example.test/owner/example",
            "identity.storage",
            "1.0.0",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        let stale = build_grant(&state, &principal, first.clone())
            .expect("retargeting the lexical link must not redirect a prepared grant");
        assert!(matches!(
            stale.grant.scope,
            PermissionScope::ExternalStorage(ExternalStorageScope { ref canonical_roots })
                if canonical_roots == &vec![target_a.clone()]
        ));

        std::fs::rename(&target_a, external_root.join("storage-a-original"))
            .expect("confirmed target should move");
        std::fs::create_dir(&target_a).expect("replacement target should exist");
        assert!(build_grant(&state, &principal, first).is_err());

        let _ = std::fs::remove_dir_all(temp_root);
        let _ = std::fs::remove_dir_all(external_root);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn executable_symlink_preparation_is_stable_until_the_target_changes() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let (state, _host, _plugin, temp_root, _principal_root) =
            storage_test_context("process-grant-identity", false);
        let target_a = temp_root.join("tool-a");
        let target_b = temp_root.join("tool-b");
        let link = temp_root.join("tool-link");
        let native_executable =
            std::fs::canonicalize("/bin/sh").expect("the platform shell should exist");
        std::fs::copy(&native_executable, &target_a).expect("first executable target should exist");
        std::fs::copy(&native_executable, &target_b)
            .expect("second executable target should exist");
        std::fs::set_permissions(&target_b, std::fs::Permissions::from_mode(0o700))
            .expect("second executable target should be writable by the test");
        let mut target_b_contents =
            std::fs::read(&target_b).expect("second executable should be readable");
        target_b_contents.push(0);
        std::fs::write(&target_b, target_b_contents)
            .expect("second executable target should differ by content");
        symlink(&target_a, &link).expect("executable symlink should be created");
        let descriptor = || {
            PermissionDescriptor::Structured(StructuredPermissionDescriptor::SystemProcessSpawn {
                scope: ProcessDescriptorScope {
                    executables: vec![ProcessExecutableDescriptor {
                        path: link.clone(),
                        arguments: vec!["--version".to_owned()],
                    }],
                },
            })
        };

        let first = prepare_permission_descriptor(&state, descriptor())
            .expect("first executable should prepare");
        let unchanged = prepare_permission_descriptor(&state, descriptor())
            .expect("unchanged executable should prepare");
        assert_eq!(first.target_identities[0].path, target_a);
        assert_eq!(
            first.target_identities[0].device,
            unchanged.target_identities[0].device
        );
        assert_eq!(
            first.target_identities[0].inode,
            unchanged.target_identities[0].inode
        );
        assert_eq!(
            first.target_identities[0].content_sha256,
            unchanged.target_identities[0].content_sha256
        );

        std::fs::remove_file(&link).expect("old executable symlink should be removed");
        symlink(&target_b, &link).expect("executable symlink should be retargeted");
        let retargeted = prepare_permission_descriptor(&state, descriptor())
            .expect("retargeted executable should prepare");
        assert_eq!(retargeted.target_identities[0].path, target_b);
        assert_ne!(
            first.target_identities[0].inode,
            retargeted.target_identities[0].inode
        );
        assert_ne!(
            first.target_identities[0].content_sha256,
            retargeted.target_identities[0].content_sha256
        );

        let principal = Principal::new(
            "https://plugins.example.test/owner/example",
            "identity.process",
            "1.0.0",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );
        let stale = build_grant(&state, &principal, first.clone())
            .expect("retargeting the lexical link must not redirect a prepared executable");
        assert!(matches!(
            stale.grant.scope,
            PermissionScope::Process(ProcessScope { ref rules })
                if rules.len() == 1 && rules[0].executable == target_a.as_path()
        ));

        std::fs::rename(&target_a, temp_root.join("tool-a-original"))
            .expect("confirmed executable should move");
        std::fs::copy(&native_executable, &target_a).expect("replacement executable should exist");
        assert!(build_grant(&state, &principal, first).is_err());

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn executable_grant_rejects_in_place_content_change_with_the_same_inode() {
        use std::os::unix::fs::PermissionsExt;

        let (state, _host, _plugin, temp_root, _principal_root) =
            storage_test_context("process-grant-content", false);
        let executable = temp_root.join("approved-tool");
        std::fs::copy(
            std::fs::canonicalize("/bin/sh").expect("the platform shell should exist"),
            &executable,
        )
        .expect("the approved executable should be copied");
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700))
            .expect("the approved executable should be writable by the test");
        let descriptor = || {
            PermissionDescriptor::Structured(StructuredPermissionDescriptor::SystemProcessSpawn {
                scope: ProcessDescriptorScope {
                    executables: vec![ProcessExecutableDescriptor {
                        path: executable.clone(),
                        arguments: vec!["--version".to_owned()],
                    }],
                },
            })
        };
        let prepared = prepare_permission_descriptor(&state, descriptor())
            .expect("the original executable should prepare");
        let approved_inode = prepared.target_identities[0].inode.clone();
        let approved_sha256 = prepared.target_identities[0]
            .content_sha256
            .clone()
            .expect("process preparation should include a content digest");

        let mut replacement =
            std::fs::read(&executable).expect("the approved executable should be readable");
        replacement.push(0);
        std::fs::write(&executable, replacement)
            .expect("the executable should be overwritten in place");
        let overwritten = prepare_permission_descriptor(&state, descriptor())
            .expect("the overwritten native executable should still prepare");
        assert_eq!(overwritten.target_identities[0].inode, approved_inode);
        assert_ne!(
            overwritten.target_identities[0].content_sha256,
            Some(approved_sha256)
        );

        let principal = Principal::new(
            "https://plugins.example.test/owner/example",
            "identity.process.content",
            "1.0.0",
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        );
        let error = match build_grant(&state, &principal, prepared) {
            Err(error) => error,
            Ok(_) => panic!("the remembered grant must not survive an in-place overwrite"),
        };
        assert!(matches!(
            error,
            CommandError::InvalidRequest { ref message }
                if message.contains("changed after permission confirmation")
        ));

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn executable_script_preparation_requires_an_exact_interpreter_rule() {
        let (state, _host, _plugin, temp_root, _principal_root) =
            storage_test_context("process-script-identity", false);
        let script = temp_root.join("approved-script");
        std::fs::write(&script, b"#!/bin/sh\nprintf script\n")
            .expect("the executable script should exist");
        let descriptor =
            PermissionDescriptor::Structured(StructuredPermissionDescriptor::SystemProcessSpawn {
                scope: ProcessDescriptorScope {
                    executables: vec![ProcessExecutableDescriptor {
                        path: script,
                        arguments: Vec::new(),
                    }],
                },
            });

        let error = prepare_permission_descriptor(&state, descriptor)
            .expect_err("scripts cannot preserve close-on-exec descriptor binding");

        assert!(matches!(
            error,
            CommandError::InvalidRequest { ref message }
                if message.contains("exact interpreter rule")
        ));

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn plugin_process_uses_principal_cwd_and_clears_parent_environment() {
        struct ParentSentinels {
            environment_key: String,
            file_path: PathBuf,
        }

        impl Drop for ParentSentinels {
            fn drop(&mut self) {
                std::env::remove_var(&self.environment_key);
                let _ = std::fs::remove_file(&self.file_path);
            }
        }

        let (state, host, plugin, temp_root, principal_root) =
            storage_test_context("process-isolation", false);
        assert!(
            !principal_root.exists(),
            "the process preparation path should own principal cwd creation"
        );

        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let environment_key = format!("KAEDE_PROCESS_PARENT_SENTINEL_{suffix}");
        let file_name = format!(".kaede-process-parent-sentinel-{suffix}");
        let file_path = std::env::current_dir()
            .expect("parent cwd should be available")
            .join(&file_name);
        std::fs::write(&file_path, b"parent-only").expect("parent cwd sentinel should be created");
        std::env::set_var(&environment_key, "parent-secret");
        let _parent_sentinels = ParentSentinels {
            environment_key: environment_key.clone(),
            file_path,
        };

        let executable = std::fs::canonicalize("/bin/sh")
            .expect("the platform shell executable should be available");
        let environment_probe = format!("${{{environment_key}+x}}");
        let plugin_script = format!(
            "if [ -n \"{environment_probe}\" ]; then printf 'inherited-env'; exit 20; fi; \
             if [ -e \"$1\" ]; then printf 'inherited-cwd'; exit 21; fi; \
             process_cwd=$(pwd); printf 'cwd=%s\\narg=%s\\n' \"$process_cwd\" \"$2\""
        );
        let plugin_arguments = vec![
            "-c".to_owned(),
            plugin_script,
            "kaede-process-isolation-probe".to_owned(),
            file_name.clone(),
            "exact-argument-preserved".to_owned(),
        ];
        let (_, executable_identity, executable_sha256) =
            prepare_process_executable(&executable, "test_process_identity")
                .expect("test executable identity should be readable");
        lock_authorizer(&state)
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::SystemProcessSpawn,
                    scope: PermissionScope::Process(ProcessScope {
                        rules: vec![ProcessRule::exact(
                            executable.clone(),
                            ProcessTargetIdentity::new(
                                executable_identity.device_string(),
                                executable_identity.inode_string(),
                                executable_sha256,
                            ),
                            plugin_arguments.clone(),
                        )],
                    }),
                },
            )
            .expect("exact process grant should apply");

        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_shellx::init(false))
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");
        let plugin_command = prepare_process_command(
            app.handle(),
            &state,
            &plugin,
            ProcessSpec {
                executable: executable.clone(),
                arguments: plugin_arguments,
                cwd: None,
                environment: BTreeMap::new(),
            },
        )
        .expect("authorized plugin process should prepare");
        assert!(
            principal_root.is_dir(),
            "plugin principal cwd should be created before spawn"
        );
        let plugin_output = plugin_command
            .output_for_test()
            .expect("authorized plugin process should execute");
        let plugin_stdout = String::from_utf8_lossy(&plugin_output.stdout);
        let plugin_stderr = String::from_utf8_lossy(&plugin_output.stderr);
        assert!(
            plugin_output.status.success(),
            "isolated plugin process failed; stdout={plugin_stdout:?}, stderr={plugin_stderr:?}"
        );
        assert!(
            plugin_stdout.contains(&format!("cwd={}", principal_root.display())),
            "plugin process should run in its exact principal root; stdout={plugin_stdout:?}"
        );
        assert!(
            plugin_stdout.contains("arg=exact-argument-preserved"),
            "the exact authorized arguments should still execute; stdout={plugin_stdout:?}"
        );

        let host_environment_probe = format!("${{{environment_key}}}");
        let host_script = format!(
            "if [ \"{host_environment_probe}\" != 'parent-secret' ]; then exit 30; fi; \
             if [ ! -e \"$1\" ]; then exit 31; fi; printf 'host-inheritance-preserved\\n'"
        );
        let host_command = prepare_process_command(
            app.handle(),
            &state,
            &host,
            ProcessSpec {
                executable,
                arguments: vec![
                    "-c".to_owned(),
                    host_script,
                    "kaede-host-inheritance-probe".to_owned(),
                    file_name,
                ],
                cwd: None,
                environment: BTreeMap::new(),
            },
        )
        .expect("host process should prepare with its existing inheritance behavior");
        let host_output = host_command
            .output_for_test()
            .expect("host process should execute");
        assert!(
            host_output.status.success(),
            "host cwd and environment inheritance should remain unchanged; stdout={:?}, stderr={:?}",
            String::from_utf8_lossy(&host_output.stdout),
            String::from_utf8_lossy(&host_output.stderr)
        );

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    #[test]
    fn process_preparation_fails_closed_on_unsupported_platforms() {
        let error = prepare_process_executable(
            Path::new("identity-bound-process-is-unsupported"),
            "test_process_identity",
        )
        .expect_err("unsupported platforms must reject process preparation");

        assert!(matches!(
            error,
            CommandError::InvalidRequest { ref message }
                if message == "identity-bound process execution is unsupported on this platform"
        ));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn plugin_process_executes_the_exact_approved_bytes_after_in_place_overwrite() {
        use std::os::unix::fs::PermissionsExt;
        use std::sync::{Arc, Barrier};

        let (state, host, plugin, temp_root, _principal_root) =
            storage_test_context("process-exec-identity", false);
        let executable = temp_root.join("approved-tool");
        std::fs::copy(
            std::fs::canonicalize("/bin/sh").expect("the platform shell should exist"),
            &executable,
        )
        .expect("the approved executable should be copied");
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700))
            .expect("the approved executable should be writable by the test");
        let approved_inode = FileIdentity::from_metadata(
            &std::fs::metadata(&executable).expect("approved metadata should be readable"),
        )
        .inode_string();
        let arguments = vec!["-c".to_owned(), "printf pinned-original".to_owned()];
        let (_, executable_identity, executable_sha256) =
            prepare_process_executable(&executable, "test_process_exec_identity")
                .expect("the approved executable identity should be readable");
        lock_authorizer(&state)
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::SystemProcessSpawn,
                    scope: PermissionScope::Process(ProcessScope {
                        rules: vec![ProcessRule::exact(
                            executable.clone(),
                            ProcessTargetIdentity::new(
                                executable_identity.device_string(),
                                executable_identity.inode_string(),
                                executable_sha256,
                            ),
                            arguments.clone(),
                        )],
                    }),
                },
            )
            .expect("the exact executable identity grant should apply");
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_shellx::init(false))
            .build(tauri::generate_context!())
            .expect("mock Tauri application should build");
        let command = prepare_process_command(
            app.handle(),
            &state,
            &plugin,
            ProcessSpec {
                executable: executable.clone(),
                arguments,
                cwd: None,
                environment: BTreeMap::new(),
            },
        )
        .expect("the authorized executable should prepare");

        let overwrite_start = Arc::new(Barrier::new(2));
        let overwrite_finished = Arc::new(Barrier::new(2));
        let attacker_path = executable.clone();
        let attacker_start = Arc::clone(&overwrite_start);
        let attacker_finished = Arc::clone(&overwrite_finished);
        let attacker = std::thread::spawn(move || {
            attacker_start.wait();
            let result = std::fs::write(&attacker_path, b"#!/bin/sh\nprintf replacement\n")
                .and_then(|()| {
                    std::fs::set_permissions(&attacker_path, std::fs::Permissions::from_mode(0o755))
                });
            attacker_finished.wait();
            result
        });
        overwrite_start.wait();
        overwrite_finished.wait();
        attacker
            .join()
            .expect("the replacement thread should finish")
            .expect("the authorized executable should be overwritten in place");
        assert_eq!(
            FileIdentity::from_metadata(
                &std::fs::metadata(&executable).expect("replacement metadata should be readable"),
            )
            .inode_string(),
            approved_inode,
            "the regression requires an inode-preserving overwrite"
        );

        let output = command
            .output_for_test()
            .expect("the content-bound executable snapshot should run");
        assert!(
            output.status.success(),
            "the in-place replacement ran instead of the approved bytes"
        );
        assert_eq!(output.stdout, b"pinned-original");

        let _ = std::fs::remove_dir_all(temp_root);
    }

    #[test]
    fn plugin_http_rejects_virtual_host_overrides() {
        for name in ["Host", "host", ":authority"] {
            assert!(validate_plugin_http_headers(&[HttpHeader {
                name: name.to_owned(),
                value: "other.example".to_owned(),
            }])
            .is_err());
        }
        assert!(validate_plugin_http_headers(&[HttpHeader {
            name: "Accept".to_owned(),
            value: "application/json".to_owned(),
        }])
        .is_ok());
    }

    #[test]
    fn http_result_revalidation_observes_plugin_revocation() {
        let state = broker_test_state("http-revalidation");
        let host = SessionToken::new("host");
        let plugin = SessionToken::new("plugin");
        let http_method = method("GET");
        {
            let mut authorizer = lock_authorizer(&state);
            authorizer
                .bootstrap_host(host.clone(), 1)
                .expect("host should bootstrap");
            authorizer
                .open_plugin(
                    &host,
                    plugin.clone(),
                    Principal::new(
                        "https://plugins.example.test/owner/example",
                        "example.plugin",
                        "1.0.0",
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    ),
                )
                .expect("plugin should open");
            authorizer
                .grant(
                    &host,
                    &plugin,
                    CapabilityGrant {
                        permission: PermissionId::NetworkHttp,
                        scope: PermissionScope::Network(NetworkScope {
                            rules: vec![HttpRule::new(
                                HttpOrigin::from_url("https://example.com")
                                    .expect("origin should parse"),
                                vec![http_method.clone()],
                            )],
                        }),
                    },
                )
                .expect("network grant should apply");
        }
        let url = reqwest::Url::parse("https://example.com/data").expect("URL should parse");
        assert!(reauthorize_http(&state, &plugin, &url, &http_method, true).is_ok());
        lock_authorizer(&state)
            .revoke_plugin(&host, &plugin)
            .expect("plugin should revoke");
        assert!(reauthorize_http(&state, &plugin, &url, &http_method, true).is_err());
    }
}

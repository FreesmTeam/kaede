//! In-memory authorization domain for the typed plugin capability broker.
//!
//! Availability policy (quotas, rate limits, and counters) deliberately lives outside this
//! authorizer. Callers must canonicalize filesystem paths before constructing storage operations;
//! containment checks here are component-aware and never use string prefixes.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use std::net::IpAddr;
use std::path::{Component, Path, PathBuf};

const MAX_PLUGIN_ID_LENGTH: usize = 128;
const MAX_PLUGIN_VERSION_LENGTH: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Principal {
    pub repository_origin: String,
    pub plugin_id: String,
    pub version: String,
    pub artifact_sha256: String,
}

impl Principal {
    pub fn new(
        repository_origin: impl Into<String>,
        plugin_id: impl Into<String>,
        version: impl Into<String>,
        artifact_sha256: impl Into<String>,
    ) -> Self {
        Self {
            repository_origin: repository_origin.into(),
            plugin_id: plugin_id.into(),
            version: version.into(),
            artifact_sha256: artifact_sha256.into(),
        }
    }

    fn is_valid(&self) -> bool {
        is_valid_repository_origin(&self.repository_origin)
            && is_valid_plugin_id(&self.plugin_id)
            && is_valid_plugin_version(&self.version)
            && self.artifact_sha256.len() == 64
            && self
                .artifact_sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum PermissionId {
    #[serde(rename = "ui/basic")]
    UiBasic,
    #[serde(rename = "ui/forms/non-credential")]
    UiFormsNonCredential,
    #[serde(rename = "network/http")]
    NetworkHttp,
    #[serde(rename = "storage/internal/read")]
    StorageInternalRead,
    #[serde(rename = "storage/internal/write")]
    StorageInternalWrite,
    #[serde(rename = "storage/external/read")]
    StorageExternalRead,
    #[serde(rename = "storage/external/write")]
    StorageExternalWrite,
    #[serde(rename = "system/process/spawn")]
    SystemProcessSpawn,
    #[serde(rename = "system/shell")]
    SystemShell,
    #[serde(rename = "events/subscribe")]
    EventsSubscribe,
    #[serde(rename = "logging/write")]
    LoggingWrite,
}

impl PermissionId {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::UiBasic => "ui/basic",
            Self::UiFormsNonCredential => "ui/forms/non-credential",
            Self::NetworkHttp => "network/http",
            Self::StorageInternalRead => "storage/internal/read",
            Self::StorageInternalWrite => "storage/internal/write",
            Self::StorageExternalRead => "storage/external/read",
            Self::StorageExternalWrite => "storage/external/write",
            Self::SystemProcessSpawn => "system/process/spawn",
            Self::SystemShell => "system/shell",
            Self::EventsSubscribe => "events/subscribe",
            Self::LoggingWrite => "logging/write",
        }
    }
}

impl fmt::Display for PermissionId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SessionToken(String);

impl SessionToken {
    pub fn new(token: impl Into<String>) -> Self {
        Self(token.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    fn is_valid(&self) -> bool {
        !self.0.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ResourceHandle(String);

impl ResourceHandle {
    pub fn new(handle: impl Into<String>) -> Self {
        Self(handle.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    fn is_valid(&self) -> bool {
        !self.0.is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HttpScheme {
    Http,
    Https,
}

impl HttpScheme {
    const fn default_port(self) -> u16 {
        match self {
            Self::Http => 80,
            Self::Https => 443,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct HttpOrigin {
    scheme: HttpScheme,
    host: String,
    port: u16,
}

impl HttpOrigin {
    pub fn new(
        scheme: HttpScheme,
        host: impl AsRef<str>,
        port: Option<u16>,
    ) -> Result<Self, BrokerError> {
        let normalized_host = normalize_host(host.as_ref())?;
        let effective_port = match port {
            Some(0) => return Err(BrokerError::InvalidUrl),
            Some(value) => value,
            None => scheme.default_port(),
        };

        Ok(Self {
            scheme,
            host: normalized_host,
            port: effective_port,
        })
    }

    pub fn from_url(url: &str) -> Result<Self, BrokerError> {
        let separator = match url.find("://") {
            Some(index) => index,
            None => return Err(BrokerError::InvalidUrl),
        };
        let scheme = match &url[..separator] {
            value if value.eq_ignore_ascii_case("http") => HttpScheme::Http,
            value if value.eq_ignore_ascii_case("https") => HttpScheme::Https,
            _ => return Err(BrokerError::InvalidUrl),
        };
        let remainder = &url[separator + 3..];
        let authority_end = remainder.find(['/', '?', '#']).unwrap_or(remainder.len());
        let authority = &remainder[..authority_end];

        if authority.is_empty() || authority.contains('@') || authority.contains('\\') {
            return Err(BrokerError::InvalidUrl);
        }

        let (host, port) = split_authority(authority)?;
        Self::new(scheme, host, port)
    }

    pub const fn scheme(&self) -> HttpScheme {
        self.scheme
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    pub const fn port(&self) -> u16 {
        self.port
    }

    fn is_valid(&self) -> bool {
        match Self::new(self.scheme, &self.host, Some(self.port)) {
            Ok(normalized) => normalized == *self,
            Err(_) => false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(transparent)]
pub struct HttpMethod(String);

impl HttpMethod {
    pub fn new(method: impl Into<String>) -> Result<Self, BrokerError> {
        let method = method.into();
        if !is_fetch_safe_http_method(&method) {
            return Err(BrokerError::InvalidHttpMethod);
        }
        Ok(Self(method))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    fn is_valid(&self) -> bool {
        Self::new(self.0.clone()).is_ok()
    }
}

impl<'de> Deserialize<'de> for HttpMethod {
    fn deserialize<Deserializer>(deserializer: Deserializer) -> Result<Self, Deserializer::Error>
    where
        Deserializer: serde::Deserializer<'de>,
    {
        let method = String::deserialize(deserializer)?;
        Self::new(method).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HttpRule {
    pub origin: HttpOrigin,
    pub methods: Vec<HttpMethod>,
}

impl HttpRule {
    pub fn new(origin: HttpOrigin, methods: Vec<HttpMethod>) -> Self {
        Self { origin, methods }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkScope {
    pub rules: Vec<HttpRule>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InternalStorageScope {
    /// The plugin-specific directory after the host has canonicalized it.
    pub principal_directory: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExternalStorageScope {
    /// Allowed roots after the host has canonicalized them.
    pub canonical_roots: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum ProcessArgumentPattern {
    Exact(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProcessRule {
    pub executable: PathBuf,
    pub target_identity: ProcessTargetIdentity,
    pub argument_patterns: Vec<ProcessArgumentPattern>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProcessTargetIdentity {
    pub device: String,
    pub inode: String,
    pub content_sha256: String,
}

impl ProcessTargetIdentity {
    pub fn new(
        device: impl Into<String>,
        inode: impl Into<String>,
        content_sha256: impl Into<String>,
    ) -> Self {
        Self {
            device: device.into(),
            inode: inode.into(),
            content_sha256: content_sha256.into(),
        }
    }

    fn is_valid(&self) -> bool {
        let filesystem_identity_is_valid = [self.device.as_str(), self.inode.as_str()]
            .into_iter()
            .all(|value| {
                value
                    .parse::<u64>()
                    .is_ok_and(|parsed| parsed.to_string() == value)
            });
        filesystem_identity_is_valid
            && self.content_sha256.len() == 64
            && self
                .content_sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    }
}

impl ProcessRule {
    pub fn exact(
        executable: impl Into<PathBuf>,
        target_identity: ProcessTargetIdentity,
        arguments: Vec<String>,
    ) -> Self {
        Self {
            executable: executable.into(),
            target_identity,
            argument_patterns: arguments
                .into_iter()
                .map(ProcessArgumentPattern::Exact)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProcessScope {
    pub rules: Vec<ProcessRule>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "descriptor", rename_all = "snake_case")]
pub enum PermissionScope {
    Unscoped,
    Network(NetworkScope),
    InternalStorage(InternalStorageScope),
    ExternalStorage(ExternalStorageScope),
    Process(ProcessScope),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityGrant {
    pub permission: PermissionId,
    pub scope: PermissionScope,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Operation {
    Unscoped,
    Http {
        url: String,
        method: HttpMethod,
    },
    InternalStorage {
        canonical_path: PathBuf,
    },
    ExternalStorage {
        canonical_path: PathBuf,
    },
    Process {
        executable: PathBuf,
        target_identity: ProcessTargetIdentity,
        arguments: Vec<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostSession {
    pub token: SessionToken,
    pub generation: u64,
    pub revoked: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginSession {
    pub token: SessionToken,
    pub generation: u64,
    pub revoked: bool,
    pub principal: Principal,
    pub grants: Vec<CapabilityGrant>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceBinding {
    pub handle: ResourceHandle,
    pub owner: SessionToken,
    pub generation: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Revocation {
    pub already_revoked: bool,
    pub cleanup_handles: Vec<ResourceHandle>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BrokerError {
    HostAlreadyBootstrapped,
    InvalidSessionToken,
    HostSessionRequired,
    PluginSessionRequired,
    SessionRevoked,
    SessionTokenInUse,
    GenerationMustIncrease,
    InvalidPrincipal,
    InvalidGrant(&'static str),
    PermissionDenied(PermissionId),
    ScopeDenied(PermissionId),
    InvalidUrl,
    InvalidHttpMethod,
    InvalidCanonicalPath,
    InvalidResourceHandle,
    ResourceHandleInUse,
    ResourceOwnedByAnotherSession,
}

impl fmt::Display for BrokerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HostAlreadyBootstrapped => formatter.write_str("host was already bootstrapped"),
            Self::InvalidSessionToken => formatter.write_str("session token is invalid or unknown"),
            Self::HostSessionRequired => formatter.write_str("an active host session is required"),
            Self::PluginSessionRequired => {
                formatter.write_str("an active plugin session is required")
            }
            Self::SessionRevoked => formatter.write_str("session is revoked"),
            Self::SessionTokenInUse => formatter.write_str("session token was already used"),
            Self::GenerationMustIncrease => {
                formatter.write_str("new generation must be greater than the active generation")
            }
            Self::InvalidPrincipal => formatter.write_str("plugin principal is invalid"),
            Self::InvalidGrant(reason) => {
                write!(formatter, "capability grant is invalid: {reason}")
            }
            Self::PermissionDenied(permission) => {
                write!(formatter, "permission is not granted: {permission}")
            }
            Self::ScopeDenied(permission) => {
                write!(
                    formatter,
                    "operation is outside the granted scope: {permission}"
                )
            }
            Self::InvalidUrl => formatter.write_str("HTTP URL or origin is invalid"),
            Self::InvalidHttpMethod => formatter.write_str("HTTP method is invalid"),
            Self::InvalidCanonicalPath => {
                formatter.write_str("path must be absolute, canonical, and traversal-free")
            }
            Self::InvalidResourceHandle => formatter.write_str("resource handle is invalid"),
            Self::ResourceHandleInUse => formatter.write_str("resource handle is already bound"),
            Self::ResourceOwnedByAnotherSession => {
                formatter.write_str("resource is owned by another session")
            }
        }
    }
}

impl std::error::Error for BrokerError {}

#[derive(Debug, Default)]
pub struct Authorizer {
    host_was_bootstrapped: bool,
    active_host: Option<SessionToken>,
    last_generation: Option<u64>,
    host_sessions: BTreeMap<SessionToken, HostSession>,
    plugin_sessions: BTreeMap<SessionToken, PluginSession>,
    resources: BTreeMap<ResourceHandle, ResourceBinding>,
}

impl Authorizer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn bootstrap_host(
        &mut self,
        token: SessionToken,
        generation: u64,
    ) -> Result<(), BrokerError> {
        if self.host_was_bootstrapped {
            return Err(BrokerError::HostAlreadyBootstrapped);
        }
        if self
            .last_generation
            .is_some_and(|last_generation| generation <= last_generation)
        {
            return Err(BrokerError::GenerationMustIncrease);
        }
        self.validate_unused_token(&token)?;

        let session = HostSession {
            token: token.clone(),
            generation,
            revoked: false,
        };
        self.host_sessions.insert(token.clone(), session);
        self.active_host = Some(token);
        self.last_generation = Some(generation);
        self.host_was_bootstrapped = true;
        Ok(())
    }

    /// Ends the authorization lifetime of the current WebView page.
    ///
    /// This is crate-visible for the Tauri `on_page_load` hook and is intentionally not exposed as
    /// an IPC command. Session and token history remains intact across page loads.
    pub(crate) fn reset_for_page_load(&mut self) -> Vec<ResourceHandle> {
        if let Some(active_host) = self.active_host.as_ref()
            && let Some(host) = self.host_sessions.get_mut(active_host)
        {
            host.revoked = true;
        }
        for plugin in self.plugin_sessions.values_mut() {
            plugin.revoked = true;
        }

        self.active_host = None;
        self.host_was_bootstrapped = false;
        self.resources.keys().cloned().collect()
    }

    pub fn open_plugin(
        &mut self,
        host_token: &SessionToken,
        plugin_token: SessionToken,
        principal: Principal,
    ) -> Result<(), BrokerError> {
        let generation = self.require_active_host(host_token)?.generation;
        self.validate_unused_token(&plugin_token)?;
        if !principal.is_valid() {
            return Err(BrokerError::InvalidPrincipal);
        }

        let session = PluginSession {
            token: plugin_token.clone(),
            generation,
            revoked: false,
            principal,
            grants: Vec::new(),
        };
        self.plugin_sessions.insert(plugin_token, session);
        Ok(())
    }

    pub fn grant(
        &mut self,
        host_token: &SessionToken,
        plugin_token: &SessionToken,
        grant: CapabilityGrant,
    ) -> Result<(), BrokerError> {
        let active_generation = self.require_active_host(host_token)?.generation;
        validate_grant(&grant)?;
        let plugin = self.require_active_plugin_mut(plugin_token)?;
        if plugin.generation != active_generation {
            return Err(BrokerError::SessionRevoked);
        }
        if plugin
            .grants
            .iter()
            .any(|existing| grants_conflict(existing.permission, grant.permission))
        {
            return Err(BrokerError::InvalidGrant(
                "process spawn grants cannot coexist with storage write grants",
            ));
        }
        plugin.grants.push(grant);
        Ok(())
    }

    pub fn authorize_operation(
        &self,
        plugin_token: &SessionToken,
        permission: PermissionId,
        operation: &Operation,
    ) -> Result<(), BrokerError> {
        let plugin = self.require_active_plugin(plugin_token)?;
        let mut matching_grants = plugin
            .grants
            .iter()
            .filter(|grant| grant.permission == permission)
            .peekable();
        if matching_grants.peek().is_none() {
            return Err(BrokerError::PermissionDenied(permission));
        }

        validate_operation(permission, operation)?;
        if matching_grants.any(|grant| scope_allows(&grant.scope, operation)) {
            Ok(())
        } else {
            Err(BrokerError::ScopeDenied(permission))
        }
    }

    /// Redirects never inherit the authorization of the preceding request.
    pub fn authorize_http_redirect(
        &self,
        plugin_token: &SessionToken,
        redirect_url: impl Into<String>,
        method: HttpMethod,
    ) -> Result<(), BrokerError> {
        self.authorize_operation(
            plugin_token,
            PermissionId::NetworkHttp,
            &Operation::Http {
                url: redirect_url.into(),
                method,
            },
        )
    }

    pub fn bind_resource(
        &mut self,
        owner: &SessionToken,
        handle: ResourceHandle,
    ) -> Result<(), BrokerError> {
        let generation = self.require_active_session_generation(owner)?;
        if !handle.is_valid() {
            return Err(BrokerError::InvalidResourceHandle);
        }
        if self.resources.contains_key(&handle) {
            return Err(BrokerError::ResourceHandleInUse);
        }

        self.resources.insert(
            handle.clone(),
            ResourceBinding {
                handle,
                owner: owner.clone(),
                generation,
            },
        );
        Ok(())
    }

    /// Releases a resource after backend-observed termination.
    ///
    /// Cleanup must also work after the owner was revoked. This remains crate-visible so IPC
    /// callers cannot release resources they do not own.
    pub(crate) fn release_resource(&mut self, handle: &ResourceHandle) -> Option<ResourceBinding> {
        self.resources.remove(handle)
    }

    pub fn list_resource_handles(
        &self,
        owner: &SessionToken,
    ) -> Result<Vec<ResourceHandle>, BrokerError> {
        self.require_active_session_generation(owner)?;
        Ok(self
            .resources
            .values()
            .filter(|binding| &binding.owner == owner)
            .map(|binding| binding.handle.clone())
            .collect())
    }

    pub fn revoke_plugin(
        &mut self,
        host_token: &SessionToken,
        plugin_token: &SessionToken,
    ) -> Result<Revocation, BrokerError> {
        self.require_active_host(host_token)?;
        let already_revoked = match self.plugin_sessions.get_mut(plugin_token) {
            Some(plugin) => {
                let was_revoked = plugin.revoked;
                plugin.revoked = true;
                was_revoked
            }
            None if self.host_sessions.contains_key(plugin_token) => {
                return Err(BrokerError::PluginSessionRequired);
            }
            None => return Err(BrokerError::InvalidSessionToken),
        };

        Ok(Revocation {
            already_revoked,
            cleanup_handles: self.resource_handles_owned_by(plugin_token),
        })
    }

    pub fn active_host_session(&self) -> Option<&HostSession> {
        self.active_host
            .as_ref()
            .and_then(|token| self.host_sessions.get(token))
    }

    pub fn host_session(&self, token: &SessionToken) -> Option<&HostSession> {
        self.host_sessions.get(token)
    }

    pub fn plugin_session(&self, token: &SessionToken) -> Option<&PluginSession> {
        self.plugin_sessions.get(token)
    }

    fn validate_unused_token(&self, token: &SessionToken) -> Result<(), BrokerError> {
        if !token.is_valid() {
            return Err(BrokerError::InvalidSessionToken);
        }
        if self.host_sessions.contains_key(token) || self.plugin_sessions.contains_key(token) {
            return Err(BrokerError::SessionTokenInUse);
        }
        Ok(())
    }

    fn require_active_host(&self, token: &SessionToken) -> Result<&HostSession, BrokerError> {
        match self.host_sessions.get(token) {
            Some(host) if host.revoked => Err(BrokerError::SessionRevoked),
            Some(host) if self.active_host.as_ref() == Some(token) => Ok(host),
            Some(_) => Err(BrokerError::HostSessionRequired),
            None if self.plugin_sessions.contains_key(token) => {
                Err(BrokerError::HostSessionRequired)
            }
            None => Err(BrokerError::InvalidSessionToken),
        }
    }

    fn require_active_plugin(&self, token: &SessionToken) -> Result<&PluginSession, BrokerError> {
        match self.plugin_sessions.get(token) {
            Some(plugin) if plugin.revoked => Err(BrokerError::SessionRevoked),
            Some(plugin) => Ok(plugin),
            None if self.host_sessions.contains_key(token) => {
                Err(BrokerError::PluginSessionRequired)
            }
            None => Err(BrokerError::InvalidSessionToken),
        }
    }

    fn require_active_plugin_mut(
        &mut self,
        token: &SessionToken,
    ) -> Result<&mut PluginSession, BrokerError> {
        if self.host_sessions.contains_key(token) {
            return Err(BrokerError::PluginSessionRequired);
        }
        match self.plugin_sessions.get_mut(token) {
            Some(plugin) if plugin.revoked => Err(BrokerError::SessionRevoked),
            Some(plugin) => Ok(plugin),
            None => Err(BrokerError::InvalidSessionToken),
        }
    }

    fn require_active_session_generation(&self, token: &SessionToken) -> Result<u64, BrokerError> {
        if let Some(host) = self.host_sessions.get(token) {
            return if host.revoked || self.active_host.as_ref() != Some(token) {
                Err(BrokerError::SessionRevoked)
            } else {
                Ok(host.generation)
            };
        }
        self.require_active_plugin(token)
            .map(|plugin| plugin.generation)
    }

    fn resource_handles_owned_by(&self, owner: &SessionToken) -> Vec<ResourceHandle> {
        self.resources
            .values()
            .filter(|binding| &binding.owner == owner)
            .map(|binding| binding.handle.clone())
            .collect()
    }
}

fn grants_conflict(existing: PermissionId, incoming: PermissionId) -> bool {
    (existing == PermissionId::SystemProcessSpawn && is_storage_write(incoming))
        || (incoming == PermissionId::SystemProcessSpawn && is_storage_write(existing))
}

fn is_storage_write(permission: PermissionId) -> bool {
    matches!(
        permission,
        PermissionId::StorageInternalWrite | PermissionId::StorageExternalWrite
    )
}

fn validate_grant(grant: &CapabilityGrant) -> Result<(), BrokerError> {
    match (grant.permission, &grant.scope) {
        (PermissionId::NetworkHttp, PermissionScope::Network(scope)) => {
            if scope.rules.is_empty() {
                return Err(BrokerError::InvalidGrant("network rules cannot be empty"));
            }
            for rule in &scope.rules {
                if !rule.origin.is_valid() || rule.methods.is_empty() {
                    return Err(BrokerError::InvalidGrant(
                        "network origins and methods must be valid and non-empty",
                    ));
                }
                if rule.methods.iter().any(|method| !method.is_valid()) {
                    return Err(BrokerError::InvalidGrant("HTTP method is invalid"));
                }
            }
            Ok(())
        }
        (
            PermissionId::StorageInternalRead | PermissionId::StorageInternalWrite,
            PermissionScope::InternalStorage(scope),
        ) => validate_canonical_path(&scope.principal_directory),
        (
            PermissionId::StorageExternalRead | PermissionId::StorageExternalWrite,
            PermissionScope::ExternalStorage(scope),
        ) => {
            if scope.canonical_roots.is_empty() {
                return Err(BrokerError::InvalidGrant(
                    "external storage roots cannot be empty",
                ));
            }
            for root in &scope.canonical_roots {
                validate_canonical_path(root)?;
            }
            Ok(())
        }
        (PermissionId::SystemProcessSpawn, PermissionScope::Process(scope)) => {
            if scope.rules.is_empty() {
                return Err(BrokerError::InvalidGrant("process rules cannot be empty"));
            }
            for rule in &scope.rules {
                validate_canonical_path(&rule.executable)?;
                if !rule.target_identity.is_valid() {
                    return Err(BrokerError::InvalidGrant(
                        "process target identity is invalid",
                    ));
                }
            }
            Ok(())
        }
        (
            PermissionId::UiBasic
            | PermissionId::UiFormsNonCredential
            | PermissionId::SystemShell
            | PermissionId::EventsSubscribe
            | PermissionId::LoggingWrite,
            PermissionScope::Unscoped,
        ) => Ok(()),
        _ => Err(BrokerError::InvalidGrant(
            "scope descriptor does not match permission",
        )),
    }
}

fn validate_operation(permission: PermissionId, operation: &Operation) -> Result<(), BrokerError> {
    match (permission, operation) {
        (PermissionId::NetworkHttp, Operation::Http { url, method }) => {
            HttpOrigin::from_url(url)?;
            if !method.is_valid() {
                return Err(BrokerError::InvalidHttpMethod);
            }
            Ok(())
        }
        (
            PermissionId::StorageInternalRead | PermissionId::StorageInternalWrite,
            Operation::InternalStorage { canonical_path },
        )
        | (
            PermissionId::StorageExternalRead | PermissionId::StorageExternalWrite,
            Operation::ExternalStorage { canonical_path },
        ) => validate_canonical_path(canonical_path),
        (
            PermissionId::SystemProcessSpawn,
            Operation::Process {
                executable,
                target_identity,
                ..
            },
        ) => {
            validate_canonical_path(executable)?;
            if !target_identity.is_valid() {
                return Err(BrokerError::InvalidGrant(
                    "process target identity is invalid",
                ));
            }
            Ok(())
        }
        (
            PermissionId::UiBasic
            | PermissionId::UiFormsNonCredential
            | PermissionId::SystemShell
            | PermissionId::EventsSubscribe
            | PermissionId::LoggingWrite,
            Operation::Unscoped,
        ) => Ok(()),
        _ => Err(BrokerError::ScopeDenied(permission)),
    }
}

fn scope_allows(scope: &PermissionScope, operation: &Operation) -> bool {
    match (scope, operation) {
        (PermissionScope::Unscoped, Operation::Unscoped) => true,
        (PermissionScope::Network(scope), Operation::Http { url, method }) => {
            let origin = match HttpOrigin::from_url(url) {
                Ok(value) => value,
                Err(_) => return false,
            };
            scope
                .rules
                .iter()
                .any(|rule| rule.origin == origin && rule.methods.contains(method))
        }
        (
            PermissionScope::InternalStorage(scope),
            Operation::InternalStorage { canonical_path },
        ) => canonical_path.starts_with(&scope.principal_directory),
        (
            PermissionScope::ExternalStorage(scope),
            Operation::ExternalStorage { canonical_path },
        ) => scope
            .canonical_roots
            .iter()
            .any(|root| canonical_path.starts_with(root)),
        (
            PermissionScope::Process(scope),
            Operation::Process {
                executable,
                target_identity,
                arguments,
            },
        ) => scope
            .rules
            .iter()
            .any(|rule| process_rule_matches(rule, executable, target_identity, arguments)),
        _ => false,
    }
}

fn process_rule_matches(
    rule: &ProcessRule,
    executable: &Path,
    target_identity: &ProcessTargetIdentity,
    arguments: &[String],
) -> bool {
    rule.executable == executable
        && rule.target_identity == *target_identity
        && rule.argument_patterns.len() == arguments.len()
        && rule
            .argument_patterns
            .iter()
            .zip(arguments)
            .all(|(pattern, argument)| match pattern {
                ProcessArgumentPattern::Exact(expected) => expected == argument,
            })
}

fn validate_canonical_path(path: &Path) -> Result<(), BrokerError> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        return Err(BrokerError::InvalidCanonicalPath);
    }
    Ok(())
}

fn split_authority(authority: &str) -> Result<(&str, Option<u16>), BrokerError> {
    if let Some(bracketed) = authority.strip_prefix('[') {
        let close = match bracketed.find(']') {
            Some(index) => index,
            None => return Err(BrokerError::InvalidUrl),
        };
        let host = &bracketed[..close];
        let suffix = &bracketed[close + 1..];
        let port = if suffix.is_empty() {
            None
        } else {
            let value = match suffix.strip_prefix(':') {
                Some(value) if !value.is_empty() => value,
                _ => return Err(BrokerError::InvalidUrl),
            };
            Some(parse_port(value)?)
        };
        return Ok((host, port));
    }

    let colon_count = authority.bytes().filter(|byte| *byte == b':').count();
    match colon_count {
        0 => Ok((authority, None)),
        1 => {
            let (host, port) = match authority.rsplit_once(':') {
                Some(parts) => parts,
                None => return Err(BrokerError::InvalidUrl),
            };
            if host.is_empty() || port.is_empty() {
                return Err(BrokerError::InvalidUrl);
            }
            Ok((host, Some(parse_port(port)?)))
        }
        _ => Err(BrokerError::InvalidUrl),
    }
}

fn parse_port(port: &str) -> Result<u16, BrokerError> {
    match port.parse::<u16>() {
        Ok(0) | Err(_) => Err(BrokerError::InvalidUrl),
        Ok(value) => Ok(value),
    }
}

fn normalize_host(host: &str) -> Result<String, BrokerError> {
    let unbracketed = match host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
    {
        Some(value) => value,
        None => host,
    };
    if unbracketed.is_empty() || !unbracketed.is_ascii() {
        return Err(BrokerError::InvalidUrl);
    }
    if let Ok(address) = unbracketed.parse::<IpAddr>() {
        return Ok(address.to_string());
    }

    if unbracketed.len() > 253
        || unbracketed.starts_with('.')
        || unbracketed.ends_with('.')
        || unbracketed.split('.').any(|label| {
            label.is_empty()
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
    {
        return Err(BrokerError::InvalidUrl);
    }
    Ok(unbracketed.to_ascii_lowercase())
}

fn is_fetch_safe_http_method(method: &str) -> bool {
    matches!(
        method,
        "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
    )
}

fn is_valid_plugin_id(plugin_id: &str) -> bool {
    let bytes = plugin_id.as_bytes();
    if bytes.is_empty()
        || bytes.len() > MAX_PLUGIN_ID_LENGTH
        || !bytes[0].is_ascii_alphanumeric()
        || !bytes[bytes.len() - 1].is_ascii_alphanumeric()
        || !bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return false;
    }

    !matches!(
        plugin_id.to_ascii_lowercase().as_str(),
        "__proto__" | "prototype" | "constructor"
    )
}

fn is_valid_plugin_version(version: &str) -> bool {
    !version.is_empty()
        && version.trim() == version
        && version.chars().count() <= MAX_PLUGIN_VERSION_LENGTH
        && !version.chars().any(char::is_control)
}

fn is_valid_repository_origin(repository_origin: &str) -> bool {
    if repository_origin.is_empty()
        || repository_origin.trim() != repository_origin
        || repository_origin.contains(['\\', '?', '#'])
        || repository_origin.chars().any(char::is_control)
    {
        return false;
    }

    let (scheme, remainder) = if let Some(remainder) = repository_origin.strip_prefix("http://") {
        (HttpScheme::Http, remainder)
    } else if let Some(remainder) = repository_origin.strip_prefix("https://") {
        (HttpScheme::Https, remainder)
    } else {
        return false;
    };
    let authority_end = match remainder.find('/') {
        Some(index) => index,
        None => return false,
    };
    let authority = &remainder[..authority_end];
    let repository_path = &remainder[authority_end..];

    if repository_path == "/"
        || repository_path.ends_with('/')
        || repository_path.contains("//")
        || !repository_path.is_ascii()
        || repository_path
            .split('/')
            .skip(1)
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
        || repository_path.to_ascii_lowercase().ends_with(".git")
        || !is_canonical_repository_path(repository_path)
    {
        return false;
    }

    let parsed_origin = match HttpOrigin::from_url(repository_origin) {
        Ok(value) => value,
        Err(_) => return false,
    };
    if parsed_origin.scheme() != scheme {
        return false;
    }

    let canonical_host = if parsed_origin.host().contains(':') {
        format!("[{}]", parsed_origin.host())
    } else {
        parsed_origin.host().to_owned()
    };
    let canonical_authority = if parsed_origin.port() == scheme.default_port() {
        canonical_host
    } else {
        format!("{canonical_host}:{}", parsed_origin.port())
    };

    authority == canonical_authority
}

fn is_canonical_repository_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    let mut decoded_path = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'/' || is_url_path_character(bytes[index]) {
            decoded_path.push(bytes[index]);
            index += 1;
            continue;
        }
        if bytes[index] != b'%' {
            return false;
        }
        if index + 2 >= bytes.len() {
            return false;
        }
        let high = match canonical_hex_value(bytes[index + 1]) {
            Some(value) => value,
            None => return false,
        };
        let low = match canonical_hex_value(bytes[index + 2]) {
            Some(value) => value,
            None => return false,
        };
        let decoded = high * 16 + low;
        if decoded.is_ascii_control()
            || decoded == 0x7f
            || decoded.is_ascii_alphanumeric()
            || matches!(decoded, b'-' | b'.' | b'_' | b'~' | b'%' | b'/' | b'\\')
        {
            return false;
        }
        decoded_path.push(decoded);
        index += 3;
    }
    match std::str::from_utf8(&decoded_path) {
        Ok(decoded) => !decoded.chars().any(char::is_control),
        Err(_) => false,
    }
}

fn is_url_path_character(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
        || matches!(
            byte,
            b'-' | b'.'
                | b'_'
                | b'~'
                | b'!'
                | b'$'
                | b'&'
                | b'\''
                | b'('
                | b')'
                | b'*'
                | b'+'
                | b','
                | b';'
                | b'='
                | b':'
                | b'@'
        )
}

fn canonical_hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHA_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const SHA_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    fn token(value: &str) -> SessionToken {
        SessionToken::new(value)
    }

    fn handle(value: &str) -> ResourceHandle {
        ResourceHandle::new(value)
    }

    fn process_identity(inode: &str) -> ProcessTargetIdentity {
        ProcessTargetIdentity::new("1", inode, SHA_A)
    }

    fn process_identity_with_digest(inode: &str, content_sha256: &str) -> ProcessTargetIdentity {
        ProcessTargetIdentity::new("1", inode, content_sha256)
    }

    fn principal(artifact_sha256: &str) -> Principal {
        Principal::new(
            "https://plugins.example.test/owner/example-plugin",
            "example.plugin",
            "1.0.0",
            artifact_sha256,
        )
    }

    fn method(value: &str) -> HttpMethod {
        HttpMethod::new(value).expect("test method should be valid")
    }

    fn bootstrapped() -> (Authorizer, SessionToken) {
        let host = token("host-1");
        let mut authorizer = Authorizer::new();
        authorizer
            .bootstrap_host(host.clone(), 1)
            .expect("host bootstrap should succeed");
        (authorizer, host)
    }

    fn opened_plugin() -> (Authorizer, SessionToken, SessionToken) {
        let (mut authorizer, host) = bootstrapped();
        let plugin = token("plugin-1");
        authorizer
            .open_plugin(&host, plugin.clone(), principal(SHA_A))
            .expect("plugin open should succeed");
        (authorizer, host, plugin)
    }

    #[test]
    fn rejects_wrong_tokens_for_host_and_plugin_operations() {
        let (mut authorizer, host, plugin) = opened_plugin();
        let wrong = token("wrong");
        let grant = CapabilityGrant {
            permission: PermissionId::UiBasic,
            scope: PermissionScope::Unscoped,
        };

        assert_eq!(
            authorizer.grant(&wrong, &plugin, grant.clone()),
            Err(BrokerError::InvalidSessionToken)
        );
        assert_eq!(
            authorizer.authorize_operation(&wrong, PermissionId::UiBasic, &Operation::Unscoped),
            Err(BrokerError::InvalidSessionToken)
        );
        assert_eq!(
            authorizer.open_plugin(&plugin, token("plugin-2"), principal(SHA_B)),
            Err(BrokerError::HostSessionRequired)
        );
        authorizer
            .grant(&host, &plugin, grant)
            .expect("real host should be able to grant");
    }

    #[test]
    fn host_can_only_be_bootstrapped_once() {
        let (mut authorizer, _) = bootstrapped();
        assert_eq!(
            authorizer.bootstrap_host(token("host-2"), 2),
            Err(BrokerError::HostAlreadyBootstrapped)
        );
    }

    #[test]
    fn permission_ids_use_slash_serialization() {
        let serialized =
            serde_json::to_string(&PermissionId::NetworkHttp).expect("permission should serialize");
        assert_eq!(serialized, "\"network/http\"");
        assert_eq!(
            serde_json::from_str::<PermissionId>("\"storage/external/write\"")
                .expect("slash permission should deserialize"),
            PermissionId::StorageExternalWrite
        );
    }

    #[test]
    fn http_methods_are_limited_to_the_fetch_safe_contract() {
        for allowed in ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] {
            assert_eq!(
                HttpMethod::new(allowed).map(|method| method.as_str().to_owned()),
                Ok(allowed.to_owned())
            );
        }
        for denied in ["CONNECT", "TRACE"] {
            assert_eq!(HttpMethod::new(denied), Err(BrokerError::InvalidHttpMethod));
            assert!(
                serde_json::from_str::<HttpMethod>(&format!("\"{denied}\"")).is_err(),
                "serde should reject method: {denied}"
            );
        }
    }

    #[test]
    fn principal_requires_a_canonical_safe_repository_origin() {
        assert!(principal(SHA_A).is_valid());
        assert!(
            Principal::new(
                "https://plugins.example.test/owner/my%20plugin",
                "example.plugin",
                "1.0.0",
                SHA_A,
            )
            .is_valid()
        );
        assert!(
            Principal::new(
                "https://plugins.example.test/owner/caf%C3%A9-plugin",
                "example.plugin",
                "1.0.0",
                SHA_A,
            )
            .is_valid()
        );
        for repository_origin in [
            "HTTPS://plugins.example.test/owner/example-plugin",
            "https://Plugins.example.test/owner/example-plugin",
            "https://plugins.example.test:443/owner/example-plugin",
            "https://user@plugins.example.test/owner/example-plugin",
            "https://plugins.example.test/owner/example-plugin?ref=main",
            "https://plugins.example.test/owner/example-plugin#readme",
            "https://plugins.example.test/owner/../example-plugin",
            "https://plugins.example.test/owner/%2e%2e/example-plugin",
            "https://plugins.example.test/owner/my repo",
            "https://plugins.example.test/owner/plugin.%67it",
            "https://plugins.example.test/owner/%252e%252e/example-plugin",
            "https://plugins.example.test/owner/%C2%85example-plugin",
            "https://plugins.example.test/owner/example-plugin/",
            "https://plugins.example.test/owner/example-plugin.git",
            "https://plugins.example.test/",
            "ssh://plugins.example.test/owner/example-plugin",
        ] {
            assert!(
                !Principal::new(repository_origin, "example.plugin", "1.0.0", SHA_A).is_valid(),
                "repository origin should be rejected: {repository_origin}"
            );
        }
    }

    #[test]
    fn principal_rejects_unsafe_ids_versions_and_hashes() {
        let maximum_id = format!("a{}b", ".".repeat(126));
        assert!(
            Principal::new(
                "https://plugins.example.test/owner/example-plugin",
                maximum_id,
                "1.0.0",
                SHA_A,
            )
            .is_valid()
        );

        for plugin_id in [
            "Prototype",
            "CONSTRUCTOR",
            "__proto__",
            "contains/slash",
            "-leading",
            "trailing-",
        ] {
            assert!(
                !Principal::new(
                    "https://plugins.example.test/owner/example-plugin",
                    plugin_id,
                    "1.0.0",
                    SHA_A,
                )
                .is_valid(),
                "plugin ID should be rejected: {plugin_id}"
            );
        }
        let oversized_id = format!("a{}b", ".".repeat(127));
        assert!(
            !Principal::new(
                "https://plugins.example.test/owner/example-plugin",
                oversized_id,
                "1.0.0",
                SHA_A,
            )
            .is_valid()
        );

        for invalid_version in ["", " 1.0.0", "1.0.0\n"] {
            assert!(
                !Principal::new(
                    "https://plugins.example.test/owner/example-plugin",
                    "example.plugin",
                    invalid_version,
                    SHA_A,
                )
                .is_valid()
            );
        }
        assert!(
            !Principal::new(
                "https://plugins.example.test/owner/example-plugin",
                "example.plugin",
                "v".repeat(MAX_PLUGIN_VERSION_LENGTH + 1),
                SHA_A,
            )
            .is_valid()
        );
        assert!(
            !Principal::new(
                "https://plugins.example.test/owner/example-plugin",
                "example.plugin",
                "1.0.0",
                SHA_A.to_ascii_uppercase(),
            )
            .is_valid()
        );
    }

    #[test]
    fn page_load_reset_revokes_stale_sessions_and_allows_a_higher_generation() {
        let (mut authorizer, old_host, plugin) = opened_plugin();
        authorizer
            .bind_resource(&plugin, handle("page:resource"))
            .expect("resource binding should succeed");

        assert_eq!(
            authorizer.reset_for_page_load(),
            vec![handle("page:resource")]
        );
        assert_eq!(
            authorizer.reset_for_page_load(),
            vec![handle("page:resource")],
            "an unconfirmed cleanup must remain retryable"
        );
        assert!(authorizer.active_host_session().is_none());
        assert_eq!(
            authorizer.open_plugin(&old_host, token("late-plugin"), principal(SHA_B)),
            Err(BrokerError::SessionRevoked)
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::LoggingWrite,
                &Operation::Unscoped
            ),
            Err(BrokerError::SessionRevoked)
        );

        let new_host = token("host-2");
        authorizer
            .bootstrap_host(new_host.clone(), 2)
            .expect("higher page generation should bootstrap");
        assert_eq!(
            authorizer.open_plugin(&new_host, plugin, principal(SHA_A)),
            Err(BrokerError::SessionTokenInUse)
        );
        assert!(
            authorizer
                .host_session(&old_host)
                .expect("old host history should remain")
                .revoked
        );
    }

    #[test]
    fn page_load_reset_rejects_same_or_older_bootstrap_generations() {
        let host = token("host-7");
        let mut authorizer = Authorizer::new();
        authorizer
            .bootstrap_host(host, 7)
            .expect("initial bootstrap should succeed");
        assert!(authorizer.reset_for_page_load().is_empty());

        assert_eq!(
            authorizer.bootstrap_host(token("host-same"), 7),
            Err(BrokerError::GenerationMustIncrease)
        );
        assert_eq!(
            authorizer.bootstrap_host(token("host-older"), 6),
            Err(BrokerError::GenerationMustIncrease)
        );
        authorizer
            .bootstrap_host(token("host-8"), 8)
            .expect("strictly newer generation should bootstrap");
    }

    #[test]
    fn page_load_reset_is_idempotent_before_bootstrap() {
        let mut authorizer = Authorizer::new();
        assert!(authorizer.reset_for_page_load().is_empty());
        assert!(authorizer.reset_for_page_load().is_empty());
        authorizer
            .bootstrap_host(token("host-0"), 0)
            .expect("first bootstrap should remain available");
        assert_eq!(
            authorizer.bootstrap_host(token("host-1"), 1),
            Err(BrokerError::HostAlreadyBootstrapped)
        );
    }

    #[test]
    fn backend_can_release_a_naturally_terminated_resource_after_owner_revocation() {
        let (mut authorizer, _host, plugin) = opened_plugin();
        let resource = handle("process:natural-termination");
        authorizer
            .bind_resource(&plugin, resource.clone())
            .expect("resource should bind");
        authorizer
            .plugin_sessions
            .get_mut(&plugin)
            .expect("plugin should exist")
            .revoked = true;

        assert_eq!(
            authorizer.list_resource_handles(&plugin),
            Err(BrokerError::SessionRevoked),
            "ownership queries must remain session-gated"
        );
        assert_eq!(
            authorizer
                .release_resource(&resource)
                .expect("backend cleanup should release the binding")
                .owner,
            plugin
        );
        assert!(authorizer.release_resource(&resource).is_none());
    }

    #[test]
    fn artifact_hash_is_part_of_the_principal_and_grants_do_not_leak() {
        let (mut authorizer, host) = bootstrapped();
        let plugin_a = token("plugin-a");
        let plugin_b = token("plugin-b");
        authorizer
            .open_plugin(&host, plugin_a.clone(), principal(SHA_A))
            .expect("first artifact should open");
        authorizer
            .open_plugin(&host, plugin_b.clone(), principal(SHA_B))
            .expect("second artifact should open");
        authorizer
            .grant(
                &host,
                &plugin_a,
                CapabilityGrant {
                    permission: PermissionId::LoggingWrite,
                    scope: PermissionScope::Unscoped,
                },
            )
            .expect("grant should succeed");

        let principal_a = &authorizer
            .plugin_session(&plugin_a)
            .expect("first plugin should exist")
            .principal;
        let principal_b = &authorizer
            .plugin_session(&plugin_b)
            .expect("second plugin should exist")
            .principal;
        assert_ne!(principal_a, principal_b);
        assert_eq!(
            authorizer.authorize_operation(
                &plugin_b,
                PermissionId::LoggingWrite,
                &Operation::Unscoped
            ),
            Err(BrokerError::PermissionDenied(PermissionId::LoggingWrite))
        );
    }

    #[test]
    fn denies_permissions_that_were_not_granted() {
        let (authorizer, _, plugin) = opened_plugin();
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::EventsSubscribe,
                &Operation::Unscoped
            ),
            Err(BrokerError::PermissionDenied(PermissionId::EventsSubscribe))
        );
    }

    #[test]
    fn authorizes_exact_http_origins_methods_and_each_redirect() {
        let (mut authorizer, host, plugin) = opened_plugin();
        let origin = HttpOrigin::new(HttpScheme::Https, "example.test", None)
            .expect("origin should be valid");
        authorizer
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::NetworkHttp,
                    scope: PermissionScope::Network(NetworkScope {
                        rules: vec![HttpRule::new(origin, vec![method("GET")])],
                    }),
                },
            )
            .expect("network grant should succeed");

        let initial = Operation::Http {
            url: "https://EXAMPLE.test/api".into(),
            method: method("GET"),
        };
        assert_eq!(
            authorizer.authorize_operation(&plugin, PermissionId::NetworkHttp, &initial),
            Ok(())
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::NetworkHttp,
                &Operation::Http {
                    url: "https://example.test/api".into(),
                    method: method("POST"),
                }
            ),
            Err(BrokerError::ScopeDenied(PermissionId::NetworkHttp))
        );
        assert_eq!(
            authorizer.authorize_http_redirect(&plugin, "https://example.test/next", method("GET")),
            Ok(())
        );
        assert_eq!(
            authorizer.authorize_http_redirect(
                &plugin,
                "https://redirect.example.test/next",
                method("GET")
            ),
            Err(BrokerError::ScopeDenied(PermissionId::NetworkHttp))
        );
        assert_eq!(
            authorizer.authorize_http_redirect(
                &plugin,
                "https://example.test:444/next",
                method("GET")
            ),
            Err(BrokerError::ScopeDenied(PermissionId::NetworkHttp))
        );
    }

    #[test]
    fn enforces_internal_and_external_canonical_path_boundaries() {
        let (mut authorizer, host, plugin) = opened_plugin();
        authorizer
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::StorageInternalRead,
                    scope: PermissionScope::InternalStorage(InternalStorageScope {
                        principal_directory: PathBuf::from("/data/plugins/example.plugin"),
                    }),
                },
            )
            .expect("internal storage grant should succeed");
        authorizer
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::StorageExternalWrite,
                    scope: PermissionScope::ExternalStorage(ExternalStorageScope {
                        canonical_roots: vec![PathBuf::from("/home/user/Documents/allowed")],
                    }),
                },
            )
            .expect("external storage grant should succeed");

        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::StorageInternalRead,
                &Operation::InternalStorage {
                    canonical_path: PathBuf::from("/data/plugins/example.plugin/settings.json"),
                }
            ),
            Ok(())
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::StorageInternalRead,
                &Operation::InternalStorage {
                    canonical_path: PathBuf::from(
                        "/data/plugins/example.plugin-other/settings.json"
                    ),
                }
            ),
            Err(BrokerError::ScopeDenied(PermissionId::StorageInternalRead))
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::StorageExternalWrite,
                &Operation::ExternalStorage {
                    canonical_path: PathBuf::from("/home/user/Documents/allowed/report.txt"),
                }
            ),
            Ok(())
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::StorageExternalWrite,
                &Operation::ExternalStorage {
                    canonical_path: PathBuf::from("/home/user/Documents/allowed-other/report.txt"),
                }
            ),
            Err(BrokerError::ScopeDenied(PermissionId::StorageExternalWrite))
        );
        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::StorageExternalWrite,
                &Operation::ExternalStorage {
                    canonical_path: PathBuf::from("/home/user/Documents/allowed/../secret.txt"),
                }
            ),
            Err(BrokerError::InvalidCanonicalPath)
        );
    }

    #[test]
    fn process_scope_requires_exact_executable_and_argument_vector() {
        let (mut authorizer, host, plugin) = opened_plugin();
        authorizer
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::SystemProcessSpawn,
                    scope: PermissionScope::Process(ProcessScope {
                        rules: vec![ProcessRule::exact(
                            "/usr/bin/git",
                            process_identity("10"),
                            vec!["status".into(), "--short".into()],
                        )],
                    }),
                },
            )
            .expect("process grant should succeed");

        let exact = Operation::Process {
            executable: PathBuf::from("/usr/bin/git"),
            target_identity: process_identity("10"),
            arguments: vec!["status".into(), "--short".into()],
        };
        assert_eq!(
            authorizer.authorize_operation(&plugin, PermissionId::SystemProcessSpawn, &exact),
            Ok(())
        );
        for denied in [
            Operation::Process {
                executable: PathBuf::from("/usr/local/bin/git"),
                target_identity: process_identity("10"),
                arguments: vec!["status".into(), "--short".into()],
            },
            Operation::Process {
                executable: PathBuf::from("/usr/bin/git"),
                target_identity: process_identity("10"),
                arguments: vec!["status".into()],
            },
            Operation::Process {
                executable: PathBuf::from("/usr/bin/git"),
                target_identity: process_identity("10"),
                arguments: vec!["status".into(), "--porcelain".into()],
            },
            Operation::Process {
                executable: PathBuf::from("/usr/bin/git"),
                target_identity: process_identity("20"),
                arguments: vec!["status".into(), "--short".into()],
            },
            Operation::Process {
                executable: PathBuf::from("/usr/bin/git"),
                target_identity: process_identity_with_digest("10", SHA_B),
                arguments: vec!["status".into(), "--short".into()],
            },
        ] {
            assert_eq!(
                authorizer.authorize_operation(&plugin, PermissionId::SystemProcessSpawn, &denied),
                Err(BrokerError::ScopeDenied(PermissionId::SystemProcessSpawn))
            );
        }
    }

    #[test]
    fn process_spawn_and_storage_write_grants_cannot_coexist_in_either_order() {
        let process_grant = CapabilityGrant {
            permission: PermissionId::SystemProcessSpawn,
            scope: PermissionScope::Process(ProcessScope {
                rules: vec![ProcessRule::exact(
                    "/usr/bin/git",
                    process_identity("10"),
                    vec!["status".into()],
                )],
            }),
        };
        let storage_write_grants = [
            CapabilityGrant {
                permission: PermissionId::StorageInternalWrite,
                scope: PermissionScope::InternalStorage(InternalStorageScope {
                    principal_directory: PathBuf::from("/data/plugins/example.plugin"),
                }),
            },
            CapabilityGrant {
                permission: PermissionId::StorageExternalWrite,
                scope: PermissionScope::ExternalStorage(ExternalStorageScope {
                    canonical_roots: vec![PathBuf::from("/home/user/Documents/allowed")],
                }),
            },
        ];

        for storage_write_grant in storage_write_grants {
            for process_first in [true, false] {
                let (mut authorizer, host, plugin) = opened_plugin();
                let (first, second) = if process_first {
                    (process_grant.clone(), storage_write_grant.clone())
                } else {
                    (storage_write_grant.clone(), process_grant.clone())
                };
                authorizer
                    .grant(&host, &plugin, first)
                    .expect("first grant should be valid on its own");
                assert_eq!(
                    authorizer.grant(&host, &plugin, second),
                    Err(BrokerError::InvalidGrant(
                        "process spawn grants cannot coexist with storage write grants"
                    ))
                );
            }
        }
    }

    #[test]
    fn shell_is_an_explicit_unscoped_permission() {
        let (mut authorizer, host, plugin) = opened_plugin();
        authorizer
            .grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::SystemShell,
                    scope: PermissionScope::Unscoped,
                },
            )
            .expect("unscoped shell grant should succeed");

        assert_eq!(
            authorizer.authorize_operation(
                &plugin,
                PermissionId::SystemShell,
                &Operation::Unscoped
            ),
            Ok(())
        );
        assert_eq!(
            authorizer.grant(
                &host,
                &plugin,
                CapabilityGrant {
                    permission: PermissionId::SystemShell,
                    scope: PermissionScope::Process(ProcessScope {
                        rules: vec![ProcessRule::exact(
                            "/bin/sh",
                            process_identity("30"),
                            vec!["-c".into()],
                        )],
                    }),
                }
            ),
            Err(BrokerError::InvalidGrant(
                "scope descriptor does not match permission"
            ))
        );
    }

    #[test]
    fn resource_handle_queries_are_scoped_to_the_active_owner() {
        let (mut authorizer, host, plugin_a) = opened_plugin();
        let plugin_b = token("plugin-2");
        authorizer
            .open_plugin(&host, plugin_b.clone(), principal(SHA_B))
            .expect("second plugin should open");
        authorizer
            .bind_resource(&plugin_a, handle("stream:1"))
            .expect("resource binding should succeed");

        assert!(
            authorizer
                .list_resource_handles(&plugin_b)
                .expect("second plugin should query its own resources")
                .is_empty()
        );
        assert_eq!(
            authorizer
                .list_resource_handles(&plugin_a)
                .expect("owner should see its resource"),
            vec![handle("stream:1")]
        );
    }

    #[test]
    fn plugin_revocation_repeats_cleanup_handles_until_the_backend_releases_them() {
        let (mut authorizer, host, plugin) = opened_plugin();
        authorizer
            .bind_resource(&plugin, handle("resource:b"))
            .expect("first binding should succeed");
        authorizer
            .bind_resource(&plugin, handle("resource:a"))
            .expect("second binding should succeed");

        let first = authorizer
            .revoke_plugin(&host, &plugin)
            .expect("first revoke should succeed");
        let second = authorizer
            .revoke_plugin(&host, &plugin)
            .expect("second revoke should be idempotent");

        assert!(!first.already_revoked);
        assert_eq!(
            first.cleanup_handles,
            vec![handle("resource:a"), handle("resource:b")]
        );
        assert!(second.already_revoked);
        assert_eq!(second.cleanup_handles, first.cleanup_handles);

        authorizer.release_resource(&handle("resource:a"));
        let third = authorizer
            .revoke_plugin(&host, &plugin)
            .expect("cleanup retry should remain available");
        assert_eq!(third.cleanup_handles, vec![handle("resource:b")]);
    }
}

use super::authorizer::{PermissionId, Principal};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const DOCUMENT_VERSION: u32 = 1;
const PRINCIPAL_HISTORY_VERSION: u32 = 1;
const PRINCIPAL_HISTORY_KEY_PREFIX: &str = "principal-capability-history-v1:sha256:";
const MAX_OPAQUE_KEY_BYTES: usize = 4096;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DecisionKind {
    Dynamic,
    Static,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionKey {
    pub kind: DecisionKind,
    pub principal_key: String,
    pub request_fingerprint: String,
}

pub struct DecisionStore {
    path: PathBuf,
    principal_history_path: PathBuf,
    transaction: Mutex<()>,
}

impl DecisionStore {
    pub fn new(path: PathBuf) -> Self {
        let principal_history_path = principal_history_path(&path);
        Self {
            path,
            principal_history_path,
            transaction: Mutex::new(()),
        }
    }

    pub fn load(&self, key: &DecisionKey) -> io::Result<Option<bool>> {
        let _transaction = self
            .transaction
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        load(&self.path, key)
    }

    pub fn save(&self, key: DecisionKey, decision: bool) -> io::Result<()> {
        let _transaction = self
            .transaction
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        save(&self.path, key, decision)
    }

    pub fn record_principal_grant(
        &self,
        principal: &Principal,
        permission: PermissionId,
    ) -> io::Result<()> {
        let Some(family) = PrincipalCapabilityFamily::from_permission(permission) else {
            return Ok(());
        };
        let _transaction = self
            .transaction
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        record_principal_grant(&self.principal_history_path, principal, family)
    }
}

impl DecisionKey {
    pub fn validate(&self) -> io::Result<()> {
        validate_opaque_key("principal key", &self.principal_key)?;
        validate_opaque_key("request fingerprint", &self.request_fingerprint)
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DecisionDocument {
    version: u32,
    decisions: Vec<DecisionRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DecisionRecord {
    #[serde(flatten)]
    key: DecisionKey,
    decision: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PrincipalCapabilityFamily {
    ProcessSpawn,
    StorageWrite,
}

impl PrincipalCapabilityFamily {
    fn from_permission(permission: PermissionId) -> Option<Self> {
        match permission {
            PermissionId::SystemProcessSpawn => Some(Self::ProcessSpawn),
            PermissionId::StorageInternalWrite | PermissionId::StorageExternalWrite => {
                Some(Self::StorageWrite)
            }
            _ => None,
        }
    }

    fn conflicts_with(self, other: Self) -> bool {
        self != other
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PrincipalHistoryDocument {
    version: u32,
    principals: Vec<PrincipalHistoryRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PrincipalHistoryRecord {
    principal_key: String,
    families: BTreeSet<PrincipalCapabilityFamily>,
}

pub fn load(path: &Path, key: &DecisionKey) -> io::Result<Option<bool>> {
    key.validate()?;
    let document = read_document(path)?;
    Ok(document
        .decisions
        .iter()
        .find(|record| record.key == *key)
        .map(|record| record.decision))
}

pub fn save(path: &Path, key: DecisionKey, decision: bool) -> io::Result<()> {
    key.validate()?;
    let mut document = read_document(path)?;

    match document
        .decisions
        .iter_mut()
        .find(|record| record.key == key)
    {
        Some(record) => record.decision = decision,
        None => document.decisions.push(DecisionRecord { key, decision }),
    }
    document.decisions.sort();

    let bytes = serde_json::to_vec_pretty(&document)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    atomic_write(path, &bytes)
}

fn read_document(path: &Path) -> io::Result<DecisionDocument> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(DecisionDocument {
                version: DOCUMENT_VERSION,
                decisions: Vec::new(),
            });
        }
        Err(error) => return Err(error),
    };
    let document: DecisionDocument = serde_json::from_slice(&bytes)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    if document.version != DOCUMENT_VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unsupported capability decision document version",
        ));
    }
    for record in &document.decisions {
        record.key.validate()?;
    }
    Ok(document)
}

fn record_principal_grant(
    path: &Path,
    principal: &Principal,
    family: PrincipalCapabilityFamily,
) -> io::Result<()> {
    let mut document = read_principal_history(path)?;
    let principal_key = principal_history_key(principal);
    let record = match document
        .principals
        .iter_mut()
        .find(|record| record.principal_key == principal_key)
    {
        Some(record) => record,
        None => {
            document.principals.push(PrincipalHistoryRecord {
                principal_key,
                families: BTreeSet::new(),
            });
            document
                .principals
                .last_mut()
                .expect("the principal history record was just inserted")
        }
    };
    if record
        .families
        .iter()
        .any(|existing| family.conflicts_with(*existing))
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "process spawn and storage write grants cannot coexist for one plugin principal",
        ));
    }
    if !record.families.insert(family) {
        return Ok(());
    }
    document.principals.sort();
    let bytes = serde_json::to_vec_pretty(&document)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    atomic_write(path, &bytes)
}

fn read_principal_history(path: &Path) -> io::Result<PrincipalHistoryDocument> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(PrincipalHistoryDocument {
                version: PRINCIPAL_HISTORY_VERSION,
                principals: Vec::new(),
            });
        }
        Err(error) => return Err(error),
    };
    let document: PrincipalHistoryDocument = serde_json::from_slice(&bytes)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    if document.version != PRINCIPAL_HISTORY_VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unsupported principal capability history version",
        ));
    }
    let mut principal_keys = BTreeSet::new();
    for record in &document.principals {
        if !is_valid_principal_history_key(&record.principal_key)
            || record.families.len() != 1
            || !principal_keys.insert(&record.principal_key)
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "principal capability history is invalid",
            ));
        }
    }
    Ok(document)
}

fn principal_history_key(principal: &Principal) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"kaede-principal-capability-history-v1\0");
    for field in [
        principal.repository_origin.as_str(),
        principal.plugin_id.as_str(),
        principal.version.as_str(),
        principal.artifact_sha256.as_str(),
    ] {
        let length = u64::try_from(field.len())
            .expect("an in-memory principal field length must fit into u64");
        hasher.update(length.to_be_bytes());
        hasher.update(field.as_bytes());
    }
    let digest = hasher.finalize();
    format!(
        "{PRINCIPAL_HISTORY_KEY_PREFIX}{}",
        digest
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    )
}

fn is_valid_principal_history_key(value: &str) -> bool {
    value
        .strip_prefix(PRINCIPAL_HISTORY_KEY_PREFIX)
        .is_some_and(|digest| {
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
}

pub(super) fn principal_history_path(decisions_path: &Path) -> PathBuf {
    decisions_path.with_file_name("principal-capability-history-v1.json")
}

fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "decision path has no parent directory",
        )
    })?;
    fs::create_dir_all(parent)?;

    let mut random = [0_u8; 16];
    getrandom::fill(&mut random).map_err(io::Error::other)?;
    let suffix = random
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let temp_path = temporary_path(path, &suffix)?;

    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let result = (|| {
        let mut file = options.open(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        replace_file(&temp_path, path)?;
        FileSync::sync_parent(parent)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[cfg(not(windows))]
pub(crate) fn replace_file(temp_path: &Path, path: &Path) -> io::Result<()> {
    fs::rename(temp_path, path)
}

#[cfg(windows)]
pub(crate) fn replace_file(temp_path: &Path, path: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temp_wide = temp_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let path_wide = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    // SAFETY: both inputs are stable, NUL-terminated UTF-16 buffers for the duration of the call.
    let succeeded = unsafe {
        MoveFileExW(
            temp_wide.as_ptr(),
            path_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

fn temporary_path(path: &Path, suffix: &str) -> io::Result<PathBuf> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "decision path file name is not valid UTF-8",
            )
        })?;
    Ok(path.with_file_name(format!(".{file_name}.{suffix}.tmp")))
}

struct FileSync;

impl FileSync {
    #[cfg(unix)]
    fn sync_parent(parent: &Path) -> io::Result<()> {
        fs::File::open(parent)?.sync_all()
    }

    #[cfg(not(unix))]
    fn sync_parent(_parent: &Path) -> io::Result<()> {
        Ok(())
    }
}

fn validate_opaque_key(label: &str, value: &str) -> io::Result<()> {
    if value.is_empty() || value.len() > MAX_OPAQUE_KEY_BYTES || value.chars().any(char::is_control)
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{label} is not a bounded opaque key"),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_decisions_path(name: &str) -> PathBuf {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        std::env::temp_dir()
            .join(format!("kaede-broker-{name}-{suffix}"))
            .join("decisions.json")
    }

    fn key(principal_key: &str) -> DecisionKey {
        DecisionKey {
            kind: DecisionKind::Static,
            principal_key: principal_key.to_owned(),
            request_fingerprint: "permission-request-v1:network/http".to_owned(),
        }
    }

    fn principal(artifact_sha256: &str) -> Principal {
        Principal::new(
            "https://plugins.example.test/owner/example-plugin",
            "example.plugin",
            "1.0.0",
            artifact_sha256,
        )
    }

    #[test]
    fn decisions_are_isolated_by_the_exact_principal_key() {
        let path = temp_decisions_path("isolation");
        let first = key("plugin-principal-v1|artifact-a");
        let second = key("plugin-principal-v1|artifact-b");

        save(&path, first.clone(), true).expect("first decision should save");
        save(&path, second.clone(), false).expect("second decision should save");

        assert_eq!(
            load(&path, &first).expect("first decision should load"),
            Some(true)
        );
        assert_eq!(
            load(&path, &second).expect("second decision should load"),
            Some(false)
        );
        let artifact = fs::read_to_string(&path).expect("artifact should be readable");
        assert!(!artifact.contains("session"));
        assert!(!artifact.contains("grant"));
        let _ = fs::remove_dir_all(path.parent().expect("path should have a parent"));
    }

    #[test]
    fn corrupt_store_is_an_explicit_error() {
        let path = temp_decisions_path("corrupt");
        fs::create_dir_all(path.parent().expect("path should have a parent"))
            .expect("test directory should be created");
        fs::write(&path, b"not-json").expect("corrupt fixture should be written");

        assert_eq!(
            load(&path, &key("principal")).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            save(&path, key("principal"), true).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        let _ = fs::remove_dir_all(path.parent().expect("path should have a parent"));
    }

    #[test]
    fn sequential_save_atomically_replaces_an_existing_decision() {
        let path = temp_decisions_path("overwrite");
        let store = DecisionStore::new(path.clone());
        let decision_key = key("principal");

        store
            .save(decision_key.clone(), false)
            .expect("initial decision should save");
        store
            .save(decision_key.clone(), true)
            .expect("existing decision should be replaced");

        assert_eq!(
            store.load(&decision_key).expect("decision should load"),
            Some(true)
        );
        let _ = fs::remove_dir_all(path.parent().expect("path should have a parent"));
    }

    #[test]
    fn concurrent_distinct_saves_do_not_lose_updates() {
        use std::sync::Arc;

        let path = temp_decisions_path("concurrent");
        let store = Arc::new(DecisionStore::new(path.clone()));
        let first = key("principal-a");
        let second = key("principal-b");
        let first_store = Arc::clone(&store);
        let first_key = first.clone();
        let first_save = std::thread::spawn(move || first_store.save(first_key, true));
        let second_store = Arc::clone(&store);
        let second_key = second.clone();
        let second_save = std::thread::spawn(move || second_store.save(second_key, false));

        first_save
            .join()
            .expect("first save thread should finish")
            .expect("first decision should save");
        second_save
            .join()
            .expect("second save thread should finish")
            .expect("second decision should save");
        assert_eq!(store.load(&first).expect("first should load"), Some(true));
        assert_eq!(
            store.load(&second).expect("second should load"),
            Some(false)
        );
        let _ = fs::remove_dir_all(path.parent().expect("path should have a parent"));
    }

    #[test]
    fn rejects_empty_control_and_oversized_opaque_keys() {
        for invalid in [
            String::new(),
            "line\nbreak".to_owned(),
            "x".repeat(MAX_OPAQUE_KEY_BYTES + 1),
        ] {
            let error = key(&invalid)
                .validate()
                .expect_err("key should be rejected");
            assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        }
    }

    #[test]
    fn principal_history_key_is_versioned_bounded_and_exact() {
        let base_principal =
            principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        let first = principal_history_key(&base_principal);
        let variants = [
            Principal::new(
                "https://plugins.example.test/owner/other-plugin",
                base_principal.plugin_id.clone(),
                base_principal.version.clone(),
                base_principal.artifact_sha256.clone(),
            ),
            Principal::new(
                base_principal.repository_origin.clone(),
                "example.other-plugin",
                base_principal.version.clone(),
                base_principal.artifact_sha256.clone(),
            ),
            Principal::new(
                base_principal.repository_origin.clone(),
                base_principal.plugin_id.clone(),
                "2.0.0",
                base_principal.artifact_sha256.clone(),
            ),
            principal("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
        ];

        assert!(is_valid_principal_history_key(&first));
        assert!(first.starts_with(PRINCIPAL_HISTORY_KEY_PREFIX));
        assert_eq!(first.len(), PRINCIPAL_HISTORY_KEY_PREFIX.len() + 64);
        for variant in variants {
            assert_ne!(first, principal_history_key(&variant));
        }
    }

    #[test]
    fn process_history_rejects_each_storage_write_family_after_a_fresh_runtime() {
        for (name, write_permission) in [
            ("internal", PermissionId::StorageInternalWrite),
            ("external", PermissionId::StorageExternalWrite),
        ] {
            let decisions_path = temp_decisions_path(&format!("process-then-{name}-write"));
            let exact_principal =
                principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            DecisionStore::new(decisions_path.clone())
                .record_principal_grant(&exact_principal, PermissionId::SystemProcessSpawn)
                .expect("process history should be durably recorded");

            let error = DecisionStore::new(decisions_path.clone())
                .record_principal_grant(&exact_principal, write_permission)
                .expect_err("fresh runtime must reject storage write after process spawn");
            assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
            let _ = fs::remove_dir_all(
                decisions_path
                    .parent()
                    .expect("history path should have a parent"),
            );
        }
    }

    #[test]
    fn each_storage_write_history_rejects_process_after_a_fresh_runtime() {
        for (name, write_permission) in [
            ("internal", PermissionId::StorageInternalWrite),
            ("external", PermissionId::StorageExternalWrite),
        ] {
            let decisions_path = temp_decisions_path(&format!("{name}-write-then-process"));
            let exact_principal =
                principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            DecisionStore::new(decisions_path.clone())
                .record_principal_grant(&exact_principal, write_permission)
                .expect("storage write history should be durably recorded");

            let error = DecisionStore::new(decisions_path.clone())
                .record_principal_grant(&exact_principal, PermissionId::SystemProcessSpawn)
                .expect_err("fresh runtime must reject process spawn after storage write");
            assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
            let _ = fs::remove_dir_all(
                decisions_path
                    .parent()
                    .expect("history path should have a parent"),
            );
        }
    }

    #[test]
    fn principal_history_isolated_by_the_exact_artifact_and_never_cleared_by_decisions() {
        let decisions_path = temp_decisions_path("history-isolation");
        let first = principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        let second = principal("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        let store = DecisionStore::new(decisions_path.clone());
        store
            .record_principal_grant(&first, PermissionId::SystemProcessSpawn)
            .expect("first principal process history should save");
        store
            .save(key("frontend-principal-key"), false)
            .expect("a deny decision should save independently");
        store
            .record_principal_grant(&second, PermissionId::StorageInternalWrite)
            .expect("different artifact history should remain independent");

        let error = DecisionStore::new(decisions_path.clone())
            .record_principal_grant(&first, PermissionId::StorageExternalWrite)
            .expect_err("decision updates must not clear principal grant history");
        assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
        let _ = fs::remove_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        );
    }

    #[test]
    fn corrupt_principal_history_fails_closed() {
        let decisions_path = temp_decisions_path("corrupt-history");
        fs::create_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        )
        .expect("history directory should be created");
        fs::write(principal_history_path(&decisions_path), b"not-json")
            .expect("corrupt history should be written");

        let error = DecisionStore::new(decisions_path.clone())
            .record_principal_grant(
                &principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                PermissionId::SystemProcessSpawn,
            )
            .expect_err("corrupt history must reject the grant");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        let _ = fs::remove_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        );
    }

    #[test]
    fn concurrent_opposite_grants_commit_only_one_principal_family() {
        use std::sync::{Arc, Barrier};

        let decisions_path = temp_decisions_path("concurrent-opposite-history");
        let store = Arc::new(DecisionStore::new(decisions_path.clone()));
        let exact_principal =
            principal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        let start = Arc::new(Barrier::new(3));

        let process_store = Arc::clone(&store);
        let process_principal = exact_principal.clone();
        let process_start = Arc::clone(&start);
        let process = std::thread::spawn(move || {
            process_start.wait();
            process_store
                .record_principal_grant(&process_principal, PermissionId::SystemProcessSpawn)
        });
        let write_store = Arc::clone(&store);
        let write_principal = exact_principal.clone();
        let write_start = Arc::clone(&start);
        let write = std::thread::spawn(move || {
            write_start.wait();
            write_store.record_principal_grant(&write_principal, PermissionId::StorageExternalWrite)
        });

        start.wait();
        let results = [
            process.join().expect("process history thread should join"),
            write.join().expect("write history thread should join"),
        ];
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| {
                    result
                        .as_ref()
                        .is_err_and(|error| error.kind() == io::ErrorKind::PermissionDenied)
                })
                .count(),
            1
        );

        let document = read_principal_history(&principal_history_path(&decisions_path))
            .expect("committed history should remain readable");
        assert_eq!(document.principals.len(), 1);
        assert_eq!(document.principals[0].families.len(), 1);
        let _ = fs::remove_dir_all(
            decisions_path
                .parent()
                .expect("history path should have a parent"),
        );
    }
}

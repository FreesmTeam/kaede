use serde::Serialize;
use std::io::{Cursor, Read, Seek};
use std::path::{Path, PathBuf};
use zip::ZipArchive;

const METADATA_ENTRY: &str = "metadata.json";
const CODE_ENTRY: &str = "index.js";

const MAX_METADATA_SIZE: u64 = 64 * 1024;
const MAX_CODE_SIZE: u64 = 16 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFile {
    pub file_name: String,
    pub metadata: serde_json::Value,
    pub code: String,
    pub artifact_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFailure {
    pub file_name: String,
    pub error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsReadResult {
    pub extensions: Vec<ExtensionFile>,
    pub failures: Vec<ExtensionFailure>,
}

fn is_extension_archive(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };

    extension.eq_ignore_ascii_case("zip") || extension.eq_ignore_ascii_case("kaede")
}

fn read_limited_utf8(
    reader: impl Read,
    entry_name: &str,
    declared_size: u64,
    max_size: u64,
) -> Result<String, String> {
    if declared_size > max_size {
        return Err(format!(
            "'{entry_name}' declares {declared_size} bytes which exceeds the {max_size} bytes limit"
        ));
    }

    let mut contents = Vec::new();
    reader
        .take(max_size + 1)
        .read_to_end(&mut contents)
        .map_err(|error| format!("Could not read '{entry_name}': {error}"))?;

    if contents.len() as u64 > max_size {
        return Err(format!(
            "'{entry_name}' decompressed past the {max_size} bytes limit"
        ));
    }

    let contents = contents.strip_prefix(b"\xef\xbb\xbf").unwrap_or(&contents);

    String::from_utf8(contents.to_vec())
        .map_err(|error| format!("Could not read '{entry_name}' as UTF-8 text: {error}"))
}

fn read_entry_text<Reader: Read + Seek>(
    archive: &mut ZipArchive<Reader>,
    entry_name: &str,
    max_size: u64,
) -> Result<String, String> {
    let entry = archive
        .by_name(entry_name)
        .map_err(|error| format!("Could not find '{entry_name}' at the archive root: {error}"))?;
    let declared_size = entry.size();

    read_limited_utf8(entry, entry_name, declared_size, max_size)
}

fn read_archive(path: &Path) -> Result<(serde_json::Value, String, String), String> {
    // Parse the exact byte snapshot that identifies the principal. Reading and
    // then reopening the path would allow an in-place update to pair one
    // digest with different metadata or code.
    let bytes = std::fs::read(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    let artifact_sha256 = crate::hashes::sha256_hex(&bytes);
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("Failed to read {} as a zip: {error}", path.display()))?;

    let metadata_text = read_entry_text(&mut archive, METADATA_ENTRY, MAX_METADATA_SIZE)?;
    let metadata: serde_json::Value = serde_json::from_str(&metadata_text)
        .map_err(|error| format!("'{METADATA_ENTRY}' is not valid JSON: {error}"))?;
    let code = read_entry_text(&mut archive, CODE_ENTRY, MAX_CODE_SIZE)?;

    Ok((metadata, code, artifact_sha256))
}

pub fn read_extensions(extensions_dir: &Path) -> Result<ExtensionsReadResult, String> {
    let entries = std::fs::read_dir(extensions_dir)
        .map_err(|error| format!("Failed to read {}: {error}", extensions_dir.display()))?;
    let mut archive_paths: Vec<PathBuf> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Failed to read an entry of {}: {error}",
                extensions_dir.display()
            )
        })?;
        let path = entry.path();

        if path.is_file() && is_extension_archive(&path) {
            archive_paths.push(path);
        }
    }

    archive_paths.sort();

    let mut extensions: Vec<ExtensionFile> = Vec::new();
    let mut failures: Vec<ExtensionFailure> = Vec::new();

    for path in archive_paths {
        let file_name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();

        match read_archive(&path) {
            Ok((metadata, code, artifact_sha256)) => extensions.push(ExtensionFile {
                file_name,
                metadata,
                code,
                artifact_sha256,
            }),
            Err(error) => failures.push(ExtensionFailure { file_name, error }),
        }
    }

    Ok(ExtensionsReadResult {
        extensions,
        failures,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        CODE_ENTRY, MAX_CODE_SIZE, MAX_METADATA_SIZE, read_archive, read_extensions,
        read_limited_utf8,
    };
    use std::fs::File;
    use std::io::{Cursor, Write};
    use std::path::{Path, PathBuf};
    use zip::ZipWriter;
    use zip::write::SimpleFileOptions;

    fn fixture_root(name: &str) -> PathBuf {
        let mut random = [0_u8; 8];
        getrandom::fill(&mut random).expect("test randomness should be available");
        let suffix = random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let root = std::env::temp_dir().join(format!("kaede-extensions-{name}-{suffix}"));

        std::fs::create_dir_all(&root).expect("fixture directory should be created");
        root
    }

    fn write_archive(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).expect("archive fixture should be created");
        let mut archive = ZipWriter::new(file);

        for (name, contents) in entries {
            archive
                .start_file(*name, SimpleFileOptions::default())
                .expect("archive entry should start");
            archive
                .write_all(contents)
                .expect("archive entry should be written");
        }

        archive.finish().expect("archive fixture should finish");
    }

    fn standard_entries<'a>(metadata: &'a [u8], code: &'a [u8]) -> [(&'a str, &'a [u8]); 2] {
        [("metadata.json", metadata), ("index.js", code)]
    }

    #[test]
    fn raw_archive_digest_changes_when_only_metadata_changes() {
        let root = fixture_root("digest");
        let archive_path = root.join("digest.kaede");
        let code = b"globalThis.digestTest = true;";

        write_archive(
            &archive_path,
            &standard_entries(br#"{"id":"digest","version":"1"}"#, code),
        );
        let (_, first_code, first_digest) =
            read_archive(&archive_path).expect("first archive should parse");

        write_archive(
            &archive_path,
            &standard_entries(br#"{"id":"digest","version":"2"}"#, code),
        );
        let (_, second_code, second_digest) =
            read_archive(&archive_path).expect("second archive should parse");
        let expected_digest = crate::hashes::sha256_hex(&std::fs::read(&archive_path).unwrap());

        assert_eq!(first_code, second_code);
        assert_ne!(first_digest, second_digest);
        assert_eq!(second_digest, expected_digest);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn accepts_bom_and_enforces_declared_and_decompressed_limits() {
        let root = fixture_root("limits");
        let archive_path = root.join("bom.zip");
        let metadata = b"\xef\xbb\xbf{\"id\":\"bom\"}";
        let code = b"\xef\xbb\xbfglobalThis.bom = true;";

        write_archive(&archive_path, &standard_entries(metadata, code));
        let (parsed_metadata, parsed_code, _) =
            read_archive(&archive_path).expect("BOM archive should parse");

        assert_eq!(parsed_metadata["id"], "bom");
        assert_eq!(parsed_code, "globalThis.bom = true;");

        let declared_error = read_limited_utf8(
            Cursor::new(vec![b'a'; MAX_METADATA_SIZE as usize + 1]),
            "metadata.json",
            MAX_METADATA_SIZE + 1,
            MAX_METADATA_SIZE,
        )
        .expect_err("declared oversize should fail before reading");
        assert!(declared_error.contains("declares"));

        let decompressed_error = read_limited_utf8(
            Cursor::new(vec![b'a'; MAX_CODE_SIZE as usize + 1]),
            CODE_ENTRY,
            1,
            MAX_CODE_SIZE,
        )
        .expect_err("decompressed oversize should fail independently of the declaration");
        assert!(decompressed_error.contains("decompressed past"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn requires_exact_root_entries() {
        let root = fixture_root("root-entries");
        let nested_path = root.join("nested.kaede");
        write_archive(
            &nested_path,
            &[
                ("nested/metadata.json", br#"{"id":"nested"}"#),
                ("index.js", b"void 0"),
            ],
        );
        let nested_error = read_archive(&nested_path)
            .expect_err("nested metadata must not satisfy the root contract");
        assert!(nested_error.contains("archive root"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn scans_case_insensitively_in_order_and_isolates_archive_failures() {
        let root = fixture_root("scan");
        write_archive(
            &root.join("B.KAEDE"),
            &standard_entries(br#"{"id":"b"}"#, b"void 'b'"),
        );
        std::fs::write(root.join("C.Zip"), b"not-a-zip")
            .expect("invalid archive should be written");
        write_archive(
            &root.join("a.zip"),
            &standard_entries(br#"{"id":"a"}"#, b"void 'a'"),
        );
        std::fs::write(root.join("ignored.js"), b"void 0")
            .expect("non-archive fixture should be written");

        let result = read_extensions(&root).expect("directory scan should succeed");

        assert_eq!(
            result
                .extensions
                .iter()
                .map(|extension| extension.file_name.as_str())
                .collect::<Vec<_>>(),
            vec!["B.KAEDE", "a.zip"]
        );
        assert_eq!(result.failures.len(), 1);
        assert_eq!(result.failures[0].file_name, "C.Zip");

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn directory_read_error_fails_the_operation() {
        let missing = fixture_root("missing").join("does-not-exist");
        let error = read_extensions(&missing).expect_err("directory error should fail the scan");

        assert!(error.contains("Failed to read"));
    }
}

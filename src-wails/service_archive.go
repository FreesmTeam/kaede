/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"unicode/utf8"
)

/*
 * The Go counterpart of zip.rs, modrinth.rs and extensions.rs.
 *
 * Those three Rust modules are all "open a zip and read it carefully", so they
 * share one service here. Every archive the launcher opens is untrusted third
 * party content — modpacks, native jars, extension bundles — which makes the
 * entry validation below (arcSafeEntryPath plus arcResolveWithin) the security
 * boundary of this whole file rather than an incidental helper.
 *
 * Error strings are reproduced verbatim from the Rust so the frontend keeps
 * logging and matching the messages it was written against.
 */

// Mirrors the constants of modrinth.rs and extensions.rs.
const (
	arcManifestEntry = "modrinth.index.json"
	arcTrustedPrefix = "https://cdn.modrinth.com/"
	arcMetadataEntry = "metadata.json"
	arcCodeEntry     = "index.js"
	// Cheap zip-bomb guards: an extension may not declare or decompress past
	// 64 KiB of metadata and 16 MiB of code.
	arcMaxMetadataSize = 64 * 1024
	arcMaxCodeSize     = 16 * 1024 * 1024
)

/*
 * OVERRIDE_PREFIXES of modrinth.rs. Both trees land in the same target
 * directory: the Rust strips either prefix and joins the remainder, so
 * "client-overrides/config/a.txt" and "overrides/config/a.txt" fight over the
 * very same destination, the later entry winning.
 */
var arcOverridePrefixes = [2]string{"overrides", "client-overrides"}

// ArchiveService carries no state: every call opens the archives it needs and
// closes them before returning.
type ArchiveService struct{}

/*
 * ArcArchiveFile is the `ArchiveFile` of zip.rs. That struct has no
 * `rename_all`, and both field names are single words, so the wire names are
 * the Rust ones as they stand.
 */
type ArcArchiveFile struct {
	Path string `json:"path"`
	// Raw zip entry name prefixes to leave unextracted, e.g. "META-INF/".
	Exclude []string `json:"exclude"`
}

/*
 * ArcUnzipOutcome replaces the untagged `UnzipOutcome` enum.
 *
 * unzip_files does not return a Result, it encodes failure inside its success
 * value (`true | string`). Go has no untagged unions, so the outcome travels as
 * a struct and the TypeScript bridge collapses it back: ok true becomes the
 * literal `true`, otherwise the joined error text is surfaced as the string.
 */
type ArcUnzipOutcome struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
}

// ArcManifestFile is `ManifestFile` of modrinth.rs, whose `rename_all =
// "camelCase"` only shows up on file_size.
type ArcManifestFile struct {
	// Relative to the Minecraft directory, e.g. "mods/sodium.jar".
	Path     string `json:"path"`
	URL      string `json:"url"`
	FileSize uint64 `json:"fileSize"`
	SHA1     string `json:"sha1"`
	SHA512   string `json:"sha512"`
	External bool   `json:"external"`
}

// ArcMrpackManifest is `MrpackManifest` of modrinth.rs. Note that the input
// manifest spells formatVersion/versionId/fileSize the same way through
// explicit serde renames, while summary stays nullable.
type ArcMrpackManifest struct {
	FormatVersion uint32            `json:"formatVersion"`
	Name          string            `json:"name"`
	VersionID     string            `json:"versionId"`
	Summary       *string           `json:"summary"`
	Dependencies  map[string]string `json:"dependencies"`
	Files         []ArcManifestFile `json:"files"`
	// How many override files were written into the target directory.
	Overrides int `json:"overrides"`
}

// ArcExtensionFile is `ExtensionFile` of extensions.rs.
type ArcExtensionFile struct {
	// The file name only, never a full path.
	FileName string `json:"fileName"`
	// The parsed metadata.json, kept as arbitrary JSON exactly like
	// serde_json::Value.
	Metadata   any    `json:"metadata"`
	Code       string `json:"code"`
	CodeSHA256 string `json:"codeSha256"`
}

// ArcExtensionFailure is `ExtensionFailure` of extensions.rs.
type ArcExtensionFailure struct {
	FileName string `json:"fileName"`
	Error    string `json:"error"`
}

// ArcExtensionsReadResult is `ExtensionsReadResult` of extensions.rs.
type ArcExtensionsReadResult struct {
	Extensions []ArcExtensionFile    `json:"extensions"`
	Failures   []ArcExtensionFailure `json:"failures"`
}

/*
 * The input manifest, `RawIndex` and friends of modrinth.rs. Every field
 * except RawFile::path carries #[serde(default)], which is also how
 * encoding/json behaves, so a manifest missing them still parses.
 */
type arcRawHashes struct {
	SHA1   string `json:"sha1"`
	SHA512 string `json:"sha512"`
}

type arcRawFile struct {
	// A pointer so a file entry without "path" can be rejected the way serde
	// rejects a missing non-defaulted field.
	Path      *string      `json:"path"`
	Hashes    arcRawHashes `json:"hashes"`
	Downloads []string     `json:"downloads"`
	FileSize  uint64       `json:"fileSize"`
}

type arcRawIndex struct {
	FormatVersion uint32            `json:"formatVersion"`
	Name          string            `json:"name"`
	VersionID     string            `json:"versionId"`
	Summary       *string           `json:"summary"`
	Dependencies  map[string]string `json:"dependencies"`
	Files         []arcRawFile      `json:"files"`
}

/*
 * ReadArchiveEntry reads one entry out of an archive without extracting it,
 * backing `read_archive_entry`.
 *
 * The Rust answers with a Vec<u8>, which Tauri renders as a JSON array of byte
 * values. Wails would render []byte as base64 anyway, so the bytes travel as an
 * explicit base64 string and the bridge rebuilds the number array the frontend
 * types. nil means "no such entry", or "the entry is a directory".
 */
func (a *ArchiveService) ReadArchiveEntry(archivePath string, entryPath string) (*string, error) {
	archive, err := arcOpenArchive(archivePath)

	if err != nil {
		return nil, err
	}

	defer archive.close()

	entry := arcFindEntry(archive.reader, entryPath)

	// Looked up by exact name, with no prefix or glob matching, just like
	// ZipArchive::by_name. A missing entry is not an error.
	if entry == nil || arcIsDirectoryEntry(entry) {
		return nil, nil
	}

	stream, err := entry.Open()

	if err != nil {
		return nil, arcEntryError(entryPath, archivePath, err)
	}

	defer stream.Close()

	bytes, err := io.ReadAll(stream)

	if err != nil {
		return nil, arcEntryError(entryPath, archivePath, err)
	}

	encoded := encodeBytes(bytes)

	return &encoded, nil
}

/*
 * UnzipFiles extracts several archives into one directory, backing
 * `unzip_files`.
 *
 * It never fails: like the Rust it collects every archive's first error and
 * joins the messages with a newline. One broken archive therefore does not
 * cancel the others. Where the Rust leaves the order to JoinSet completion, the
 * messages here follow the input order, which nothing observable depends on and
 * makes the reported text reproducible.
 */
func (a *ArchiveService) UnzipFiles(archiveFiles []ArcArchiveFile, targetDirPath string) ArcUnzipOutcome {
	messages := make([]string, len(archiveFiles))

	var waitGroup sync.WaitGroup

	for index, archiveFile := range archiveFiles {
		waitGroup.Add(1)

		go func() {
			defer waitGroup.Done()

			if err := arcExtractArchive(archiveFile, targetDirPath); err != nil {
				messages[index] = err.Error()
			}
		}()
	}

	waitGroup.Wait()

	failures := make([]string, 0, len(messages))

	for _, message := range messages {
		if message != "" {
			failures = append(failures, message)
		}
	}

	if len(failures) == 0 {
		return ArcUnzipOutcome{OK: true}
	}

	return ArcUnzipOutcome{Error: strings.Join(failures, "\n")}
}

/*
 * PeekMrpack reports what an archive would install, backing `peek_mrpack`.
 *
 * nil means "this is not an mrpack". The Rust decides that with
 * `by_name(MANIFEST_ENTRY).is_err()`, and zip-rs builds the decompressor inside
 * by_name, so an entry it cannot open counts as absent rather than as a
 * failure. The probe below keeps that distinction.
 */
func (a *ArchiveService) PeekMrpack(archivePath string) (*ArcMrpackManifest, error) {
	archive, err := arcOpenArchive(archivePath)

	if err != nil {
		return nil, err
	}

	defer archive.close()

	entry := arcFindEntry(archive.reader, arcManifestEntry)

	if entry == nil {
		return nil, nil
	}

	probe, err := entry.Open()

	if err != nil {
		return nil, nil
	}

	probe.Close()

	index, err := arcReadIndex(archive.reader, archivePath)

	if err != nil {
		return nil, err
	}

	// peek writes nothing, so the override count is always zero.
	manifest := arcBuildManifest(index, 0)

	return &manifest, nil
}

/*
 * InstallMrpack extracts the override tree of an mrpack, backing
 * `install_mrpack`.
 *
 * It deliberately does not fetch the manifest's files[]: the frontend feeds
 * those to the concurrent downloader itself. A missing manifest is a hard error
 * here, unlike in PeekMrpack.
 */
func (a *ArchiveService) InstallMrpack(archivePath string, targetDirPath string) (ArcMrpackManifest, error) {
	archive, err := arcOpenArchive(archivePath)

	if err != nil {
		return ArcMrpackManifest{}, err
	}

	defer archive.close()

	// The manifest is read and validated before anything touches the disk.
	index, err := arcReadIndex(archive.reader, archivePath)

	if err != nil {
		return ArcMrpackManifest{}, err
	}

	written, err := arcExtractOverrides(archive.reader, archivePath, targetDirPath)

	if err != nil {
		return ArcMrpackManifest{}, err
	}

	return arcBuildManifest(index, written), nil
}

/*
 * ReadExtensions loads every extension archive of a directory, backing
 * `read_extensions`.
 *
 * Only the directory scan itself can fail the call. A broken archive must not
 * keep the remaining extensions from loading, so per-archive problems are
 * reported in failures instead.
 */
func (a *ArchiveService) ReadExtensions(extensionsDirPath string) (ArcExtensionsReadResult, error) {
	// Both slices stay non-nil: the frontend iterates them unconditionally and
	// a nil slice would reach it as JSON null.
	result := ArcExtensionsReadResult{
		Extensions: []ArcExtensionFile{},
		Failures:   []ArcExtensionFailure{},
	}

	paths, err := arcExtensionArchivePaths(extensionsDirPath)

	if err != nil {
		return result, err
	}

	for _, path := range paths {
		fileName := filepath.Base(path)
		metadata, code, err := arcReadExtensionArchive(path)

		if err != nil {
			result.Failures = append(result.Failures, ArcExtensionFailure{
				FileName: fileName,
				Error:    err.Error(),
			})

			continue
		}

		// Hashed after the BOM has been stripped, so the digest describes the
		// very string the frontend will evaluate.
		digest := sha256.Sum256([]byte(code))

		result.Extensions = append(result.Extensions, ArcExtensionFile{
			FileName:   fileName,
			Metadata:   metadata,
			Code:       code,
			CodeSHA256: hex.EncodeToString(digest[:]),
		})
	}

	return result, nil
}

/*
 * arcArchive keeps an opened zip together with its file handle.
 *
 * archive/zip reads through an io.ReaderAt rather than owning the file, so the
 * handle has to outlive the reader and be closed by hand.
 */
type arcArchive struct {
	file   *os.File
	reader *zip.Reader
}

func (a *arcArchive) close() {
	_ = a.file.Close()
}

// arcOpenArchive opens a zip, keeping the two Rust error shapes apart: opening
// the file and parsing it as a zip fail with different messages.
func arcOpenArchive(archivePath string) (*arcArchive, error) {
	file, err := os.Open(archivePath)

	if err != nil {
		return nil, fmt.Errorf("Failed to open %s: %w", archivePath, err)
	}

	info, err := file.Stat()

	if err != nil {
		_ = file.Close()

		return nil, fmt.Errorf("Failed to read %s as a zip: %w", archivePath, err)
	}

	reader, err := zip.NewReader(file, info.Size())

	if err != nil {
		_ = file.Close()

		return nil, fmt.Errorf("Failed to read %s as a zip: %w", archivePath, err)
	}

	return &arcArchive{file: file, reader: reader}, nil
}

// arcFindEntry looks an entry up by its exact stored name. Archives that repeat
// a name resolve to the first occurrence.
func arcFindEntry(reader *zip.Reader, entryName string) *zip.File {
	for _, entry := range reader.File {
		if entry.Name == entryName {
			return entry
		}
	}

	return nil
}

// arcIsDirectoryEntry mirrors ZipFile::is_dir, which decides purely from the
// stored name rather than from the mode bits.
func arcIsDirectoryEntry(entry *zip.File) bool {
	return strings.HasSuffix(entry.Name, "/") ||
		strings.HasSuffix(entry.Name, `\`) ||
		entry.FileInfo().IsDir()
}

// arcEntryError is the message zip.rs uses for every failure to read a named
// entry, whether the lookup or the read itself broke.
func arcEntryError(entryPath string, archivePath string, err error) error {
	return fmt.Errorf("Failed to read the '%s' entry in %s: %w", entryPath, archivePath, err)
}

/*
 * arcSafeEntryPath turns a stored entry name into a relative slash separated
 * path, or reports that the entry must be skipped. It stands in for zip-rs's
 * enclosed_name and is the first half of the zip-slip defence.
 *
 * Rejected: empty names, names carrying a NUL, absolute names, anything with a
 * ".." component, and a leading drive or UNC prefix such as "C:". "." segments
 * are dropped. Backslashes count as separators everywhere, because archives
 * written by Windows tooling use them and validating them only on Windows
 * would leave the traversal check depending on the host.
 */
func arcSafeEntryPath(entryName string) (string, bool) {
	if entryName == "" || strings.ContainsRune(entryName, 0) {
		return "", false
	}

	unified := strings.ReplaceAll(entryName, `\`, "/")

	if strings.HasPrefix(unified, "/") {
		return "", false
	}

	segments := strings.Split(unified, "/")
	safe := make([]string, 0, len(segments))

	for _, segment := range segments {
		switch segment {
		case "", ".":
			continue
		case "..":
			return "", false
		}

		// Windows resolves a drive relative path such as "C:evil" against that
		// drive's working directory, which is outside the target.
		if len(safe) == 0 && strings.ContainsRune(segment, ':') {
			return "", false
		}

		safe = append(safe, segment)
	}

	if len(safe) == 0 {
		return "", false
	}

	return strings.Join(safe, "/"), true
}

/*
 * arcResolveWithin joins a validated relative path onto the target directory
 * and proves the result stayed inside it.
 *
 * This is redundant given arcSafeEntryPath and deliberately so: it is the
 * check that still holds if the validation above ever grows a hole, and it
 * costs nothing per entry.
 */
func arcResolveWithin(targetDir string, relative string) (string, bool) {
	base := filepath.Clean(targetDir)
	output := filepath.Join(base, filepath.FromSlash(relative))
	inside, err := filepath.Rel(base, output)

	if err != nil || inside == ".." || strings.HasPrefix(inside, ".."+string(filepath.Separator)) {
		return "", false
	}

	return output, true
}

// arcCreateDirectory mirrors create_dir_all, whose 0o777 the process umask
// trims to whatever the rest of the launcher's files get.
func arcCreateDirectory(path string) error {
	if err := os.MkdirAll(path, 0o777); err != nil {
		return fmt.Errorf("Failed to create %s: %w", path, err)
	}

	return nil
}

// arcHasAnyPrefix reproduces the exclusion test of zip.rs: a raw prefix match
// against the stored entry name, not a path component match.
func arcHasAnyPrefix(value string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(value, prefix) {
			return true
		}
	}

	return false
}

// arcExtractArchive extracts one archive into targetDir. The first failure
// abandons this archive, leaving whatever it already wrote in place, exactly
// like the Rust.
func arcExtractArchive(archiveFile ArcArchiveFile, targetDir string) error {
	archive, err := arcOpenArchive(archiveFile.Path)

	if err != nil {
		return err
	}

	defer archive.close()

	for index, entry := range archive.reader.File {
		// The exclusion check comes first, as in the Rust, so an excluded
		// entry is never even validated.
		if arcHasAnyPrefix(entry.Name, archiveFile.Exclude) {
			continue
		}

		relative, safe := arcSafeEntryPath(entry.Name)

		if !safe {
			continue
		}

		outputPath, inside := arcResolveWithin(targetDir, relative)

		if !inside {
			continue
		}

		if arcIsDirectoryEntry(entry) {
			if err := arcCreateDirectory(outputPath); err != nil {
				return err
			}

			continue
		}

		if err := arcCreateDirectory(filepath.Dir(outputPath)); err != nil {
			return err
		}

		if err := arcWriteEntry(entry, outputPath, index, archiveFile.Path); err != nil {
			return err
		}
	}

	return nil
}

/*
 * arcWriteEntry writes one file entry, overwriting whatever was there.
 *
 * The Rust reports a broken entry while fetching it by index, before it knows
 * the destination; archive/zip only fails that late, when the entry is opened,
 * so the message moves here and keeps its wording.
 */
func arcWriteEntry(entry *zip.File, outputPath string, index int, archivePath string) error {
	stream, err := entry.Open()

	if err != nil {
		return fmt.Errorf("Failed to read entry #%d in %s: %w", index, archivePath, err)
	}

	defer stream.Close()

	output, err := os.Create(outputPath)

	if err != nil {
		return fmt.Errorf("Failed to create %s: %w", outputPath, err)
	}

	if _, err := io.Copy(output, stream); err != nil {
		_ = output.Close()

		return fmt.Errorf("Failed to write %s: %w", outputPath, err)
	}

	if err := output.Close(); err != nil {
		return fmt.Errorf("Failed to write %s: %w", outputPath, err)
	}

	arcRestorePermissions(entry, outputPath)

	return nil
}

/*
 * arcRestorePermissions replays the stored permission bits, which is what keeps
 * extracted native libraries and helper binaries executable.
 *
 * zip.rs guards this with #[cfg(unix)] because on Windows chmod can only
 * toggle the read only flag, so the runtime check skips the same platform.
 * External attributes of zero are the archive saying it stored no mode at all,
 * which is the unix_mode() == None branch. Only the permission bits are
 * replayed: setuid, setgid and sticky have no business coming out of an
 * untrusted archive.
 */
func arcRestorePermissions(entry *zip.File, outputPath string) {
	if runtime.GOOS == "windows" || entry.ExternalAttrs == 0 {
		return
	}

	// Failure is ignored, as in the Rust: a file that cannot be chmod-ed was
	// still extracted correctly.
	_ = os.Chmod(outputPath, entry.Mode().Perm())
}

// arcReadIndex reads and validates modrinth.index.json.
func arcReadIndex(reader *zip.Reader, archivePath string) (arcRawIndex, error) {
	var index arcRawIndex

	entry := arcFindEntry(reader, arcManifestEntry)

	if entry == nil {
		return index, arcManifestError(archivePath, "the entry is missing")
	}

	stream, err := entry.Open()

	if err != nil {
		return index, arcManifestError(archivePath, err)
	}

	defer stream.Close()

	// Read without pre-allocating from the declared size, so a lying header
	// cannot make the launcher reserve gigabytes up front.
	contents, err := io.ReadAll(stream)

	if err != nil {
		return index, arcManifestError(archivePath, err)
	}

	if err := json.Unmarshal(contents, &index); err != nil {
		return index, fmt.Errorf("Failed to parse '%s': %w", arcManifestEntry, err)
	}

	/*
	 * RawFile::path is the one manifest field serde requires, so a file entry
	 * without it rejects the whole manifest before anything is extracted.
	 * encoding/json cannot express that, hence the explicit pass; the wording
	 * says which entry is at fault instead of quoting serde.
	 */
	for position, file := range index.Files {
		if file.Path == nil {
			return index, fmt.Errorf(
				"Failed to parse '%s': missing field 'path' in files[%d]",
				arcManifestEntry,
				position,
			)
		}
	}

	return index, nil
}

// arcManifestError is the single message modrinth.rs uses for every failure to
// obtain the manifest.
func arcManifestError(archivePath string, cause any) error {
	return fmt.Errorf("Failed to read '%s' in %s: %v", arcManifestEntry, archivePath, cause)
}

// arcBuildManifest turns the parsed manifest into the shape the frontend reads.
func arcBuildManifest(index arcRawIndex, overrides int) ArcMrpackManifest {
	// Both containers stay non-nil: the frontend walks dependencies and files
	// without a null check, and Rust's HashMap and Vec serialize as {} and [].
	dependencies := index.Dependencies

	if dependencies == nil {
		dependencies = map[string]string{}
	}

	files := make([]ArcManifestFile, 0, len(index.Files))

	for _, raw := range index.Files {
		if file, usable := arcMapManifestFile(raw); usable {
			files = append(files, file)
		}
	}

	return ArcMrpackManifest{
		FormatVersion: index.FormatVersion,
		Name:          index.Name,
		VersionID:     index.VersionID,
		Summary:       index.Summary,
		Dependencies:  dependencies,
		Files:         files,
		Overrides:     overrides,
	}
}

/*
 * arcMapManifestFile picks the download URL for one manifest file.
 *
 * The first https:// mirror wins; a file offering none is dropped from the
 * listing entirely, which is the filter_map of the Rust. Anything not served
 * from cdn.modrinth.com is flagged external so the frontend can warn about it.
 */
func arcMapManifestFile(raw arcRawFile) (ArcManifestFile, bool) {
	for _, url := range raw.Downloads {
		if !strings.HasPrefix(url, "https://") {
			continue
		}

		return ArcManifestFile{
			Path:     *raw.Path,
			URL:      url,
			FileSize: raw.FileSize,
			SHA1:     raw.Hashes.SHA1,
			SHA512:   raw.Hashes.SHA512,
			External: !strings.HasPrefix(url, arcTrustedPrefix),
		}, true
	}

	return ArcManifestFile{}, false
}

// arcExtractOverrides writes the override trees into targetDir and reports how
// many files it wrote. Directories are created but not counted, and existing
// files are overwritten.
func arcExtractOverrides(reader *zip.Reader, archivePath string, targetDir string) (int, error) {
	written := 0

	for index, entry := range reader.File {
		relative, safe := arcSafeEntryPath(entry.Name)

		if !safe {
			continue
		}

		remainder, isOverride := arcOverrideRelativePath(relative)

		if !isOverride {
			continue
		}

		outputPath, inside := arcResolveWithin(targetDir, remainder)

		if !inside {
			continue
		}

		if arcIsDirectoryEntry(entry) {
			if err := arcCreateDirectory(outputPath); err != nil {
				return written, err
			}

			continue
		}

		if err := arcCreateDirectory(filepath.Dir(outputPath)); err != nil {
			return written, err
		}

		// No permission replay here: modrinth.rs restores modes only in
		// zip.rs, and modpack overrides are plain configuration files.
		if err := arcOverrideFile(entry, outputPath, index, archivePath); err != nil {
			return written, err
		}

		written++
	}

	return written, nil
}

// arcOverrideFile writes one override entry.
func arcOverrideFile(entry *zip.File, outputPath string, index int, archivePath string) error {
	stream, err := entry.Open()

	if err != nil {
		return fmt.Errorf("Failed to read entry #%d in %s: %w", index, archivePath, err)
	}

	defer stream.Close()

	output, err := os.Create(outputPath)

	if err != nil {
		return fmt.Errorf("Failed to create %s: %w", outputPath, err)
	}

	if _, err := io.Copy(output, stream); err != nil {
		_ = output.Close()

		return fmt.Errorf("Failed to write %s: %w", outputPath, err)
	}

	if err := output.Close(); err != nil {
		return fmt.Errorf("Failed to write %s: %w", outputPath, err)
	}

	return nil
}

/*
 * arcOverrideRelativePath strips an override prefix off a validated entry path.
 *
 * The Rust uses Path::strip_prefix, which compares whole components, so
 * "overrides-extra/mods/a.jar" is not an override at all. The prefix directory
 * on its own strips to nothing and is skipped.
 */
func arcOverrideRelativePath(relative string) (string, bool) {
	for _, prefix := range arcOverridePrefixes {
		if relative == prefix {
			return "", false
		}

		if strings.HasPrefix(relative, prefix+"/") {
			remainder := relative[len(prefix)+1:]

			if remainder == "" {
				return "", false
			}

			return remainder, true
		}
	}

	return "", false
}

/*
 * arcExtensionArchivePaths lists the extension archives of a directory.
 *
 * Sorted so extensions always load in the same order. The Rust distinguishes a
 * failure to open the directory from a failure to walk it; os.ReadDir folds
 * both into one error, so the opening message covers them.
 */
func arcExtensionArchivePaths(extensionsDir string) ([]string, error) {
	entries, err := os.ReadDir(extensionsDir)

	if err != nil {
		return nil, fmt.Errorf("Failed to read %s: %w", extensionsDir, err)
	}

	paths := make([]string, 0, len(entries))

	for _, entry := range entries {
		path := filepath.Join(extensionsDir, entry.Name())

		/*
		 * extensions.rs filters with Path::is_file, which follows symlinks, so
		 * a link to an archive still loads and a broken link is simply not a
		 * file. Note that translations.rs uses the non-following check instead.
		 */
		info, err := os.Stat(path)

		if err != nil || !info.Mode().IsRegular() {
			continue
		}

		if !arcIsExtensionArchive(entry.Name()) {
			continue
		}

		paths = append(paths, path)
	}

	slices.Sort(paths)

	return paths, nil
}

// arcIsExtensionArchive keeps *.zip and *.kaede, compared case insensitively.
func arcIsExtensionArchive(fileName string) bool {
	extension := arcFileExtension(fileName)

	return strings.EqualFold(extension, "zip") || strings.EqualFold(extension, "kaede")
}

// arcFileExtension mirrors Path::extension, which sees no extension in a
// dotfile such as ".zip".
func arcFileExtension(fileName string) string {
	dot := strings.LastIndexByte(fileName, '.')

	if dot <= 0 {
		return ""
	}

	return fileName[dot+1:]
}

// arcReadExtensionArchive reads one extension bundle, returning its parsed
// metadata and its code.
func arcReadExtensionArchive(path string) (any, string, error) {
	archive, err := arcOpenArchive(path)

	if err != nil {
		return nil, "", err
	}

	defer archive.close()

	// The order matters: broken metadata is reported before a missing index.js,
	// as in the Rust.
	metadataText, err := arcReadEntryText(archive.reader, arcMetadataEntry, arcMaxMetadataSize)

	if err != nil {
		return nil, "", err
	}

	var metadata any

	if err := json.Unmarshal([]byte(metadataText), &metadata); err != nil {
		return nil, "", fmt.Errorf("'%s' is not valid JSON: %w", arcMetadataEntry, err)
	}

	code, err := arcReadEntryText(archive.reader, arcCodeEntry, arcMaxCodeSize)

	if err != nil {
		return nil, "", err
	}

	return metadata, code, nil
}

/*
 * arcReadEntryText reads a text entry from the archive root under a size limit.
 *
 * The declared size is checked first because it is free, then the read itself
 * is capped one byte past the limit so an entry lying about its size is still
 * caught. zip-rs builds the decompressor inside by_name, which is why an entry
 * that cannot be opened is reported as one that could not be found.
 */
func arcReadEntryText(reader *zip.Reader, entryName string, maxSize int64) (string, error) {
	entry := arcFindEntry(reader, entryName)

	if entry == nil {
		return "", fmt.Errorf(
			"Could not find '%s' at the archive root: the entry is missing",
			entryName,
		)
	}

	if entry.UncompressedSize64 > uint64(maxSize) {
		return "", fmt.Errorf(
			"'%s' declares %d bytes which exceeds the %d bytes limit",
			entryName,
			entry.UncompressedSize64,
			maxSize,
		)
	}

	stream, err := entry.Open()

	if err != nil {
		return "", fmt.Errorf("Could not find '%s' at the archive root: %w", entryName, err)
	}

	defer stream.Close()

	contents, err := io.ReadAll(io.LimitReader(stream, maxSize+1))

	if err != nil {
		return "", fmt.Errorf("Could not read '%s' as UTF-8 text: %w", entryName, err)
	}

	/*
	 * read_to_string decodes as it reads, so invalid UTF-8 is reported before
	 * the size overrun even when both are true. Checking in the same order
	 * keeps the reported error identical.
	 */
	if !utf8.Valid(contents) {
		return "", fmt.Errorf(
			"Could not read '%s' as UTF-8 text: stream did not contain valid UTF-8",
			entryName,
		)
	}

	if int64(len(contents)) > maxSize {
		return "", fmt.Errorf("'%s' decompressed past the %d bytes limit", entryName, maxSize)
	}

	// A single leading BOM is dropped, so the JSON parser and the JavaScript
	// engine both see a clean first character.
	return strings.TrimPrefix(string(contents), "\ufeff"), nil
}

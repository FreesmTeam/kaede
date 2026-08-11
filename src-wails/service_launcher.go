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
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
)

/*
 * LauncherService is the Go counterpart of launcher.rs: the startup state the
 * frontend needs before it can render anything, plus the two bulk file checks
 * that the instance installer runs against Minecraft artifacts.
 */

const (
	// launcherVersion mirrors `tauri.conf.json` -> "version", which is what
	// `get_initial_state` used to report through `app.package_info().version`.
	// The frontend exposes it as `__KAEDE__.internals.launcherVersion`.
	launcherVersion = "0.0.0"

	/*
	 * launcherAppIdentifier mirrors `tauri.conf.json` -> "identifier". Tauri
	 * resolved `app_data_dir()` to `{dataDir}/{identifier}`, so this exact name
	 * decides where an existing installation keeps its configuration, accounts
	 * and instances. Getting it wrong would look like a factory reset.
	 */
	launcherAppIdentifier = "kaede"

	// launcherPortableMarker next to the executable switches the launcher into
	// portable mode.
	launcherPortableMarker = "portable.txt"

	// launcherIgnoredHash is the sentinel the manifest parser assigns to
	// artifacts that ship without a published SHA1.
	launcherIgnoredHash = "ignore"

	// launcherHashBufferSize matches the 64 KiB buffer of the Rust hashers:
	// client jars and natives are hashed by streaming, never by reading them
	// whole into memory.
	launcherHashBufferSize = 64 * 1024
)

// The three `ParsedFile` variants, renamed to camelCase by serde.
const (
	launcherStatusLoaded  = "loaded"
	launcherStatusMissing = "missing"
	launcherStatusCorrupt = "corrupt"
)

// launcherFallbackLocale is used whenever the configuration does not name a
// usable one.
const launcherFallbackLocale = "en"

// The four JSON documents `get_initial_state` classifies, relative to the base
// directory.
const (
	launcherConfigFile       = "config.json"
	launcherAccountsFile     = "accounts.json"
	launcherInstancesFile    = "instances.json"
	launcherTranslationsPath = "translations"
)

/*
 * LauncherParsedFile is the internally tagged `ParsedFile` enum.
 *
 * Every payload field is a pointer so that the wire shapes are exactly serde's:
 * `{"status":"missing"}` carries nothing else, while a `loaded` document whose
 * contents are the literal `null` still reports `"data": null`. Plain values
 * plus `omitempty` could not tell those two cases apart.
 *
 * The data itself is kept as raw JSON rather than decoded into `any`, because
 * decoding would turn every number into a float64 and silently round the large
 * integers that instance metadata is full of (timestamps, file sizes).
 */
type LauncherParsedFile struct {
	Status string           `json:"status"`
	Data   *json.RawMessage `json:"data,omitempty"`
	Raw    *string          `json:"raw,omitempty"`
	Error  *string          `json:"error,omitempty"`
}

// launcherLoadedFile describes a well-formed JSON document.
func launcherLoadedFile(data json.RawMessage) LauncherParsedFile {
	return LauncherParsedFile{Status: launcherStatusLoaded, Data: &data}
}

// launcherMissingFile describes a document that is absent or empty. The
// frontend rewrites those with defaults.
func launcherMissingFile() LauncherParsedFile {
	return LauncherParsedFile{Status: launcherStatusMissing}
}

// launcherCorruptFile describes a non-empty document that is not JSON. The
// frontend backs the raw text up before replacing it.
func launcherCorruptFile(raw string, reason string) LauncherParsedFile {
	return LauncherParsedFile{Status: launcherStatusCorrupt, Raw: &raw, Error: &reason}
}

// LauncherInitialStateBasic is everything the frontend needs about the
// installation itself.
type LauncherInitialStateBasic struct {
	LauncherVersion string `json:"launcherVersion"`
	ExecutableHash  string `json:"executableHash"`
	BaseDirectory   string `json:"baseDirectory"`
	LaunchCount     int32  `json:"launchCount"`
	Separator       string `json:"separator"`
	Portable        bool   `json:"portable"`
}

// LauncherInitialStateParsedFiles holds the four documents read at startup.
type LauncherInitialStateParsedFiles struct {
	Config       LauncherParsedFile `json:"config"`
	Accounts     LauncherParsedFile `json:"accounts"`
	Instances    LauncherParsedFile `json:"instances"`
	Translations LauncherParsedFile `json:"translations"`
}

// LauncherInitialState is the `InitialState` of `get_initial_state`.
type LauncherInitialState struct {
	Basic  LauncherInitialStateBasic       `json:"basic"`
	Parsed LauncherInitialStateParsedFiles `json:"parsed"`
}

// LauncherArtifact is one entry of `verify_file_paths`. The Rust struct carried
// no `rename_all`, so the wire names are the bare field names.
type LauncherArtifact struct {
	Path string `json:"path"`
	Hash string `json:"hash"`
}

type LauncherService struct {
	/*
	 * launches replaces the `LAUNCHES_COUNT` static of launcher.rs. main.go
	 * registers exactly one instance of this service, so a field is as
	 * process-wide as the static was, and it keeps the counter out of the
	 * package namespace.
	 */
	launches atomic.Int32
}

func newLauncherService() *LauncherService {
	return &LauncherService{}
}

// GetInitialState is `get_initial_state`.
func (l *LauncherService) GetInitialState() (LauncherInitialState, error) {
	portable := launcherIsPortable()

	// `fetch_add` returned the value from BEFORE the increment, so the first
	// call of a process reports 0. The frontend treats that as "cold start".
	launchCount := l.launches.Add(1) - 1

	baseDirectory, err := launcherBaseDirectory(portable)

	if err != nil {
		return LauncherInitialState{}, err
	}

	/*
	 * The executable is hashed while the JSON documents are read, which is what
	 * the Rust `spawn_blocking` next to the `tokio::join!` achieved. The channel
	 * is buffered so that the goroutine cannot outlive an early return.
	 */
	hashes := make(chan string, 1)

	go func() {
		hashes <- launcherExecutableHash()
	}()

	files, err := launcherLoadJSONFiles(baseDirectory, []string{
		launcherConfigFile,
		launcherAccountsFile,
		launcherInstancesFile,
	})

	if err != nil {
		return LauncherInitialState{}, err
	}

	config, accounts, instances := files[0], files[1], files[2]

	// The locale lives in the configuration, so translations can only be loaded
	// once that document has been classified.
	locale := launcherExtractLocale(config)
	translations, err := launcherLoadJSONFile(
		filepath.Join(baseDirectory, launcherTranslationsPath, locale+".json"),
	)

	if err != nil {
		return LauncherInitialState{}, err
	}

	return LauncherInitialState{
		Basic: LauncherInitialStateBasic{
			LauncherVersion: launcherVersion,
			ExecutableHash:  <-hashes,
			BaseDirectory:   baseDirectory,
			LaunchCount:     launchCount,
			Separator:       string(os.PathSeparator),
			Portable:        portable,
		},
		Parsed: LauncherInitialStateParsedFiles{
			Config:       config,
			Accounts:     accounts,
			Instances:    instances,
			Translations: translations,
		},
	}, nil
}

/*
 * GetMissingFiles is `get_missing_files`: the subset of paths that do not exist,
 * in input order.
 *
 * The error is always nil. The Rust signature could only reject on a tokio join
 * failure, which has no Go counterpart, but the shape is kept so the frontend
 * contract stays the same.
 */
func (l *LauncherService) GetMissingFiles(paths []string) ([]string, error) {
	absent := make([]bool, len(paths))

	launcherParallelFor(len(paths), func(index int) {
		absent[index] = !launcherPathExists(paths[index])
	})

	// Never nil: a nil slice reaches the frontend as `null`, and the callers
	// index and measure the result as an array.
	missing := make([]string, 0, len(paths))

	for index, isAbsent := range absent {
		if isAbsent {
			missing = append(missing, paths[index])
		}
	}

	return missing, nil
}

/*
 * VerifyFilePaths is `verify_file_paths`. It returns the BAD paths, so an empty
 * array means everything verified.
 *
 * The error is always nil, for the same reason as in GetMissingFiles.
 */
func (l *LauncherService) VerifyFilePaths(artifacts []LauncherArtifact) ([]string, error) {
	broken := make([]bool, len(artifacts))

	launcherParallelFor(len(artifacts), func(index int) {
		broken[index] = launcherArtifactIsBroken(artifacts[index])
	})

	mismatched := make([]string, 0, len(artifacts))

	for index, isBroken := range broken {
		if isBroken {
			mismatched = append(mismatched, artifacts[index].Path)
		}
	}

	return mismatched, nil
}

// launcherArtifactIsBroken reports whether an artifact fails verification: a
// missing file, an unreadable file, or a SHA1 that does not match.
func launcherArtifactIsBroken(artifact LauncherArtifact) bool {
	if !launcherPathExists(artifact.Path) {
		return true
	}

	// Artifacts without a published SHA1 carry the 'ignore' sentinel, so their
	// mere presence is all that can be checked.
	if artifact.Hash == launcherIgnoredHash {
		return false
	}

	digest, err := launcherHashFile(artifact.Path, sha1.New())

	if err != nil {
		return true
	}

	/*
	 * The Rust compared against lowercase hex without normalising the expected
	 * value, and every manifest it reads is lowercase. That strictness is kept:
	 * an uppercase hash is reported as a mismatch instead of being accepted, so
	 * a malformed manifest is noticed rather than trusted.
	 */
	return digest != artifact.Hash
}

/*
 * launcherParallelFor runs work for every index below count, on at most
 * runtime.NumCPU() goroutines.
 *
 * The Rust used rayon, whose pool is also CPU-bound. The bound matters: these
 * commands are handed the whole artifact list of a Minecraft version at once,
 * and one goroutine per file would flood the disk queue with thousands of
 * concurrent reads. Work is dispatched by index so that callers can write into
 * a preallocated slice and keep the input order without locking.
 */
func launcherParallelFor(count int, work func(index int)) {
	if count <= 0 {
		return
	}

	workers := min(runtime.NumCPU(), count)
	indexes := make(chan int)

	var group sync.WaitGroup

	group.Add(workers)

	for range workers {
		go func() {
			defer group.Done()

			for index := range indexes {
				work(index)
			}
		}()
	}

	for index := range count {
		indexes <- index
	}

	close(indexes)
	group.Wait()
}

/*
 * launcherLoadJSONFiles classifies several documents of the same directory
 * concurrently, the way the Rust `tokio::join!` did.
 *
 * Failures are reported in input order, so a failing `config.json` wins over a
 * failing `accounts.json` exactly like the Rust `?` chain.
 */
func launcherLoadJSONFiles(base string, names []string) ([]LauncherParsedFile, error) {
	files := make([]LauncherParsedFile, len(names))
	failures := make([]error, len(names))

	var group sync.WaitGroup

	for index, name := range names {
		group.Add(1)

		go func() {
			defer group.Done()

			files[index], failures[index] = launcherLoadJSONFile(filepath.Join(base, name))
		}()
	}

	group.Wait()

	for _, failure := range failures {
		if failure != nil {
			return nil, failure
		}
	}

	return files, nil
}

// launcherLoadJSONFile is `load_json_file`: it classifies one document without
// ever rewriting it.
func launcherLoadJSONFile(path string) (LauncherParsedFile, error) {
	content, err := os.ReadFile(path)

	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return launcherMissingFile(), nil
		}

		/*
		 * Anything else (a permission problem, a directory in the way) is a real
		 * failure and aborts startup. The message is capitalised because the
		 * frontend logs these strings verbatim, and this one is user visible.
		 */
		return LauncherParsedFile{}, fmt.Errorf("Failed to read %s: %w", path, err)
	}

	// An empty document is rewritten with defaults, so it must not be reported
	// as corrupt: that would leave a pointless backup file behind.
	if strings.TrimSpace(string(content)) == "" {
		return launcherMissingFile(), nil
	}

	var data json.RawMessage

	// Unmarshalling into a RawMessage validates the whole document and keeps the
	// original bytes, and it is also where the parse error message comes from.
	if err := json.Unmarshal(content, &data); err != nil {
		return launcherCorruptFile(string(content), err.Error()), nil
	}

	return launcherLoadedFile(data), nil
}

// launcherExtractLocale is `extract_locale`: the top-level `locale` string of a
// loaded configuration, or the fallback.
func launcherExtractLocale(config LauncherParsedFile) string {
	if config.Status != launcherStatusLoaded || config.Data == nil {
		return launcherFallbackLocale
	}

	var probe struct {
		Locale *string `json:"locale"`
	}

	/*
	 * A configuration that is not an object, or whose `locale` is not a string,
	 * simply has no locale. The decode error is expected in that case and the
	 * nil pointer already carries the answer, which is what `data.get("locale")`
	 * on a non-object did in Rust.
	 */
	_ = json.Unmarshal(*config.Data, &probe)

	if probe.Locale == nil || !launcherIsSafeLocale(*probe.Locale) {
		return launcherFallbackLocale
	}

	return *probe.Locale
}

/*
 * launcherIsSafeLocale is the path traversal guard of the Rust code. The locale
 * is pasted straight into a file name under `translations/`, so '../accounts'
 * must never pass.
 */
func launcherIsSafeLocale(locale string) bool {
	if locale == "" {
		return false
	}

	for _, symbol := range locale {
		switch {
		case symbol >= 'a' && symbol <= 'z',
			symbol >= 'A' && symbol <= 'Z',
			symbol >= '0' && symbol <= '9',
			symbol == '-',
			symbol == '_':
		default:
			return false
		}
	}

	return true
}

// launcherIsPortable is `is_portable`: a marker file next to the executable.
func launcherIsPortable() bool {
	executable, err := os.Executable()

	if err != nil {
		return false
	}

	return launcherPathExists(filepath.Join(filepath.Dir(executable), launcherPortableMarker))
}

// launcherBaseDirectory is the directory holding every launcher file.
func launcherBaseDirectory(portable bool) (string, error) {
	if !portable {
		return launcherApplicationDataDirectory()
	}

	// A portable installation keeps everything next to the executable, so that
	// the whole launcher can live on a removable drive.
	executable, err := os.Executable()

	if err != nil {
		return "", err
	}

	directory := filepath.Dir(executable)

	if directory == "" || directory == "." {
		return "", errors.New("Failed to get executable directory")
	}

	return directory, nil
}

/*
 * launcherApplicationDataDirectory reimplements Tauri's `app_data_dir()`, which
 * was `{dataDir}/{identifier}`. Wails has its own notion of an application data
 * directory, but it is not reachable from here and it would not agree with the
 * Tauri layout anyway, so the three platform rules are spelled out instead.
 */
func launcherApplicationDataDirectory() (string, error) {
	switch runtime.GOOS {
	case "windows":
		// dirs-rs reads FOLDERID_RoamingAppData, which is what %APPDATA% holds.
		roaming := os.Getenv("APPDATA")

		if roaming == "" {
			return "", errors.New("Failed to resolve the application data directory: APPDATA is not set")
		}

		return filepath.Join(roaming, launcherAppIdentifier), nil
	case "darwin":
		home, err := os.UserHomeDir()

		if err != nil {
			return "", fmt.Errorf("Failed to resolve the application data directory: %w", err)
		}

		return filepath.Join(home, "Library", "Application Support", launcherAppIdentifier), nil
	default:
		// XDG only honours an absolute $XDG_DATA_HOME and ignores a relative
		// one, and so does dirs-rs.
		if data := os.Getenv("XDG_DATA_HOME"); filepath.IsAbs(data) {
			return filepath.Join(data, launcherAppIdentifier), nil
		}

		home, err := os.UserHomeDir()

		if err != nil {
			return "", fmt.Errorf("Failed to resolve the application data directory: %w", err)
		}

		return filepath.Join(home, ".local", "share", launcherAppIdentifier), nil
	}
}

/*
 * launcherExecutableHash is the SHA256 of the running executable, in lowercase
 * hex. Every failure collapses to an empty string, mirroring the Rust
 * `.ok().flatten().unwrap_or_default()`: extensions use the hash to detect a
 * changed build, but it is never a reason to refuse to start.
 */
func launcherExecutableHash() string {
	executable, err := os.Executable()

	if err != nil {
		return ""
	}

	digest, err := launcherHashFile(executable, sha256.New())

	if err != nil {
		return ""
	}

	return digest
}

// launcherHashFile streams a file through hasher and returns lowercase hex.
func launcherHashFile(path string, hasher hash.Hash) (string, error) {
	file, err := os.Open(path)

	if err != nil {
		return "", err
	}

	defer file.Close()

	if _, err := io.CopyBuffer(hasher, file, make([]byte, launcherHashBufferSize)); err != nil {
		return "", err
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// launcherPathExists mirrors Rust's `Path::exists()`, which reports false for
// every error rather than only for a missing entry.
func launcherPathExists(path string) bool {
	_, err := os.Stat(path)

	return err == nil
}

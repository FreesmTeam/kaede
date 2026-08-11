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
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
)

/*
 * FinalizationService is the Go counterpart of finalization.rs: it creates the
 * launcher directory tree and discovers the Java runtimes installed on the
 * machine.
 */

// How a Java major version was obtained. These three literals are a union type
// on the frontend, so they must stay exactly as they are.
const (
	// finalSourceReleaseFile means the JDK's own 'release' file answered, so no
	// JVM was started.
	finalSourceReleaseFile = "release-file"
	// finalSourceSpawn means `java -version` had to be run.
	finalSourceSpawn = "spawn"
	// finalSourceUnresolved means the major version is unknown.
	finalSourceUnresolved = "unresolved"
)

// Where a Java installation was found. Also a frontend union type;
// `detectJavaInstallations` singles out "environment" as the default runtime.
const (
	finalSourceEnvironment = "environment"
	finalSourceJavaHome    = "java-home"
	finalSourcePath        = "path"
	finalSourceScan        = "scan"
)

const (
	// finalReleaseFileName sits next to 'bin/' in a JDK home and describes the
	// runtime without starting it.
	finalReleaseFileName = "release"
	finalJavaVersionKey  = "JAVA_VERSION"
	finalImplementorKey  = "IMPLEMENTOR"

	// finalUnknownVendor is reported when neither the release file nor the
	// startup banner names a vendor.
	finalUnknownVendor = "Unknown"

	// finalJavaExecutable is the base name every candidate is built from.
	finalJavaExecutable = "java"

	// finalJavaWindowedExecutable is the console-less Windows launcher, which
	// prints its banner nowhere useful.
	finalJavaWindowedExecutable = "javaw"

	// finalDirectoryPermissions matches Rust's `create_dir_all`, which asks for
	// 0777 and lets the umask decide. Go applies the umask the same way, so the
	// directories end up with the user's usual mode instead of a hardcoded one.
	finalDirectoryPermissions = 0o777
)

// FinalLauncherInitReport is the `LauncherInitReport` of
// `finalize_initialization`.
type FinalLauncherInitReport struct {
	CreatedDirectories []string `json:"createdDirectories"`
	// A pointer without omitempty: an unknown major must reach the frontend as
	// `null`, which is what it checks for before falling back to Java 8.
	JavaMajor       *uint32 `json:"javaMajor"`
	JavaMajorSource string  `json:"javaMajorSource"`
}

// FinalJavaMajorReport is the `JavaMajorReport` of `get_java_major`.
type FinalJavaMajorReport struct {
	Major  *uint32 `json:"major"`
	Source string  `json:"source"`
}

// FinalJavaInstallation is one entry of `detect_java_installations`.
type FinalJavaInstallation struct {
	Path    string  `json:"path"`
	Vendor  string  `json:"vendor"`
	Version string  `json:"version"`
	Major   *uint32 `json:"major"`
	Source  string  `json:"source"`
}

// finalJavaCandidate is a possible `java` executable together with how it was
// found. The source travels with the path because it ends up in the report.
type finalJavaCandidate struct {
	path   string
	source string
}

type FinalizationService struct{}

/*
 * FinalizeInitialization is `finalize_initialization`.
 *
 * javaBinary is a pointer because the bridge models an omitted argument as null,
 * while the Rust argument was a required String. A missing binary is treated as
 * the empty string, which is what `resolve_java_path("")` did: there is nothing
 * to probe, so the report degrades to "unresolved" rather than failing. Java
 * detection is never allowed to break startup.
 */
func (f *FinalizationService) FinalizeInitialization(
	baseDirectory string,
	folders []string,
	javaBinary *string,
) (FinalLauncherInitReport, error) {
	binary := ""

	if javaBinary != nil {
		binary = *javaBinary
	}

	/*
	 * Directory creation and Java detection are independent, and the Rust ran
	 * both at once with `tokio::join!`. Keeping that overlap is worth the
	 * goroutine: probing Java may have to start a JVM, which dwarfs the handful
	 * of mkdir calls.
	 */
	var (
		major  *uint32
		source string
		group  sync.WaitGroup
	)

	group.Add(1)

	go func() {
		defer group.Done()

		major, source = finalDetectJavaMajor(binary)
	}()

	created, err := finalEnsureDirectories(baseDirectory, folders)

	// Waiting before the error check keeps the goroutine's writes ordered before
	// they are read, on every exit path.
	group.Wait()

	if err != nil {
		// The message is capitalised and worded exactly like the Rust one: the
		// frontend logs it verbatim.
		return FinalLauncherInitReport{}, fmt.Errorf("Failed to create launcher directories: %w", err)
	}

	return FinalLauncherInitReport{
		CreatedDirectories: created,
		JavaMajor:          major,
		JavaMajorSource:    source,
	}, nil
}

/*
 * GetJavaMajor is `get_java_major`.
 *
 * The error is always nil. The Rust signature could only reject on a tokio join
 * failure, which has no Go counterpart, but the shape is kept so the frontend
 * contract stays the same.
 */
func (f *FinalizationService) GetJavaMajor(javaBinary string) (FinalJavaMajorReport, error) {
	major, source := finalDetectJavaMajor(javaBinary)

	return FinalJavaMajorReport{Major: major, Source: source}, nil
}

// DetectJavaInstallations is `detect_java_installations`. The error is always
// nil, for the same reason as in GetJavaMajor; individual probe failures are
// silently dropped.
func (f *FinalizationService) DetectJavaInstallations() ([]FinalJavaInstallation, error) {
	return finalCollectJavaInstallations(), nil
}

// finalEnsureDirectories creates the missing launcher folders and reports the
// full paths of the ones it actually had to create.
func finalEnsureDirectories(base string, folders []string) ([]string, error) {
	// Never nil: the frontend joins this array for its startup log line, so a
	// null would arrive where an array is expected.
	created := make([]string, 0, len(folders))

	for _, folder := range folders {
		path := filepath.Join(base, folder)

		// An existing directory is not reported, which is how the frontend can
		// tell a first run from a normal one.
		if launcherPathExists(path) {
			continue
		}

		if err := os.MkdirAll(path, finalDirectoryPermissions); err != nil {
			return nil, err
		}

		created = append(created, path)
	}

	return created, nil
}

/*
 * finalDetectJavaMajor resolves the major version of one Java binary.
 *
 * The 'release' file is tried first because reading a few hundred bytes is far
 * cheaper than starting a JVM, which on a cold cache takes hundreds of
 * milliseconds and would be paid on every launcher start.
 */
func finalDetectJavaMajor(javaBinary string) (*uint32, string) {
	executable, found := finalResolveJavaPath(javaBinary)

	if !found {
		return nil, finalSourceUnresolved
	}

	if version, found := finalReadReleaseFile(executable)[finalJavaVersionKey]; found {
		if major := finalParseJavaMajor(version); major != nil {
			return major, finalSourceReleaseFile
		}
	}

	if banner, spawned := finalBannerFromSpawn(executable); spawned {
		if major := finalMajorFromBanner(banner); major != nil {
			return major, finalSourceSpawn
		}
	}

	return nil, finalSourceUnresolved
}

// finalCollectJavaInstallations gathers, deduplicates, probes and sorts every
// Java runtime it can find.
func finalCollectJavaInstallations() []FinalJavaInstallation {
	candidates := finalDeduplicateCandidates(finalGatherJavaCandidates())
	probed := make([]*FinalJavaInstallation, len(candidates))

	// Probing may start a JVM per candidate, so it reuses the bounded pool of
	// service_launcher.go instead of spawning them all at once.
	launcherParallelFor(len(candidates), func(index int) {
		probed[index] = finalProbeJavaInstallation(candidates[index].path, candidates[index].source)
	})

	// Never nil: the frontend stores this array in its Java state and scans it.
	installations := make([]FinalJavaInstallation, 0, len(candidates))

	for _, installation := range probed {
		if installation != nil {
			installations = append(installations, *installation)
		}
	}

	/*
	 * Newest first, then by path so that two scans of the same machine agree.
	 * An unparseable major sorts last, which is how Rust ordered
	 * `Option<u32>` (None is smaller than any Some, and the comparison is
	 * reversed).
	 */
	sort.SliceStable(installations, func(first int, second int) bool {
		left, right := installations[first], installations[second]

		switch {
		case left.Major == nil && right.Major != nil:
			return false
		case left.Major != nil && right.Major == nil:
			return true
		case left.Major != nil && right.Major != nil && *left.Major != *right.Major:
			return *left.Major > *right.Major
		}

		return left.Path < right.Path
	})

	return installations
}

/*
 * finalGatherJavaCandidates lists every possible `java` executable.
 *
 * The order is the order of the Rust: the environment first, then JAVA_HOME,
 * then PATH, then the well-known install directories. It decides which source a
 * duplicated runtime is reported under, because deduplication keeps the first
 * occurrence.
 */
func finalGatherJavaCandidates() []finalJavaCandidate {
	executable := finalJavaExecutable + finalExecutableSuffix()
	candidates := make([]finalJavaCandidate, 0, 16)

	if resolved, found := finalResolveJavaPath(finalJavaExecutable); found {
		candidates = append(candidates, finalJavaCandidate{resolved, finalSourceEnvironment})
	}

	if home, declared := os.LookupEnv("JAVA_HOME"); declared {
		candidates = append(candidates, finalJavaCandidate{
			filepath.Join(home, "bin", executable),
			finalSourceJavaHome,
		})
	}

	for _, directory := range filepath.SplitList(os.Getenv("PATH")) {
		candidates = append(candidates, finalJavaCandidate{
			filepath.Join(directory, executable),
			finalSourcePath,
		})
	}

	for _, root := range finalJavaDirectoryRoots() {
		entries, err := os.ReadDir(root)

		// A root that does not exist on this machine is simply skipped.
		if err != nil {
			continue
		}

		for _, entry := range entries {
			home := filepath.Join(root, entry.Name())

			// A macOS JVM nests its home inside the bundle, and that layout is
			// tried first because it is where the real 'bin/java' lives.
			if runtime.GOOS == "darwin" {
				candidates = append(candidates, finalJavaCandidate{
					filepath.Join(home, "Contents", "Home", "bin", executable),
					finalSourceScan,
				})
			}

			candidates = append(candidates, finalJavaCandidate{
				filepath.Join(home, "bin", executable),
				finalSourceScan,
			})
		}
	}

	// Every join above is speculative, so only the ones that turned out to be
	// real files survive.
	existing := make([]finalJavaCandidate, 0, len(candidates))

	for _, candidate := range candidates {
		if finalIsRegularFile(candidate.path) {
			existing = append(existing, candidate)
		}
	}

	return existing
}

/*
 * finalDeduplicateCandidates drops candidates that resolve to the same file.
 *
 * The canonical path is only an identity key: the original path is what gets
 * probed and reported, so somebody who launches through '/usr/bin/java' still
 * sees that path instead of the symlink target inside the JDK.
 */
func finalDeduplicateCandidates(candidates []finalJavaCandidate) []finalJavaCandidate {
	seen := make(map[string]struct{}, len(candidates))
	unique := make([]finalJavaCandidate, 0, len(candidates))

	for _, candidate := range candidates {
		key := finalCanonicalPath(candidate.path)

		if _, found := seen[key]; found {
			continue
		}

		seen[key] = struct{}{}
		unique = append(unique, candidate)
	}

	return unique
}

// finalCanonicalPath is the Go analogue of `fs::canonicalize`: absolute, with
// symlinks resolved and, on Windows, with the on-disk letter case. It degrades
// to the best form it managed to compute, because it is only used for matching.
func finalCanonicalPath(path string) string {
	absolute, err := filepath.Abs(path)

	if err != nil {
		return path
	}

	resolved, err := filepath.EvalSymlinks(absolute)

	if err != nil {
		return absolute
	}

	return resolved
}

// finalProbeJavaInstallation describes one candidate, or returns nil when it
// cannot be identified at all.
func finalProbeJavaInstallation(javaExe string, source string) *FinalJavaInstallation {
	// Reading the 'release' file is much cheaper than starting the runtime.
	release := finalReadReleaseFile(javaExe)

	if version, found := release[finalJavaVersionKey]; found {
		vendor := finalUnknownVendor

		if implementor, found := release[finalImplementorKey]; found {
			vendor = implementor
		}

		return &FinalJavaInstallation{
			Path:    javaExe,
			Vendor:  vendor,
			Version: version,
			Major:   finalParseJavaMajor(version),
			Source:  source,
		}
	}

	banner, spawned := finalBannerFromSpawn(javaExe)

	if !spawned {
		return nil
	}

	version, described := finalVersionFromBanner(banner)

	if !described {
		return nil
	}

	return &FinalJavaInstallation{
		Path:    javaExe,
		Vendor:  finalVendorFromBanner(banner),
		Version: version,
		Major:   finalParseJavaMajor(version),
		Source:  source,
	}
}

/*
 * finalResolveJavaPath turns a binary name into a usable path.
 *
 * An absolute path is taken at face value; anything else is looked up in PATH,
 * after the platform's executable suffix has been added. That is why the
 * frontend can pass the bare string "java".
 */
func finalResolveJavaPath(javaBinary string) (string, bool) {
	if filepath.IsAbs(javaBinary) {
		if finalIsRegularFile(javaBinary) {
			return javaBinary, true
		}

		return "", false
	}

	name := javaBinary
	suffix := finalExecutableSuffix()

	if suffix != "" && !strings.HasSuffix(name, suffix) {
		name += suffix
	}

	// exec.LookPath is deliberately avoided: it also consults PATHEXT and the
	// current directory on Windows, which would accept candidates the Rust
	// never did.
	for _, directory := range filepath.SplitList(os.Getenv("PATH")) {
		candidate := filepath.Join(directory, name)

		if finalIsRegularFile(candidate) {
			return candidate, true
		}
	}

	return "", false
}

/*
 * finalReadReleaseFile parses the JDK's 'release' file into key/value pairs. It
 * returns nil when there is none, so a caller can look a key up on the result
 * either way.
 */
func finalReadReleaseFile(javaExe string) map[string]string {
	path, addressable := finalReleaseFilePath(javaExe)

	if !addressable {
		return nil
	}

	content, err := os.ReadFile(path)

	if err != nil {
		return nil
	}

	entries := make(map[string]string)

	for _, line := range finalTextLines(string(content)) {
		key, value, separated := strings.Cut(line, "=")

		// Lines without '=' (blank ones, mostly) carry nothing.
		if !separated {
			continue
		}

		// Values are quoted: JAVA_VERSION="21.0.1".
		entries[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"`)
	}

	return entries
}

/*
 * finalReleaseFilePath maps '<home>/bin/java' to '<home>/release'.
 *
 * It refuses a path without two parent components, which is what the Rust
 * `parent()?.parent()?` chain did for a bare name such as "java". Without that
 * guard filepath.Dir would fold up to "." and read a stray 'release' file from
 * the working directory.
 */
func finalReleaseFilePath(javaExe string) (string, bool) {
	parent := filepath.Dir(javaExe)

	if parent == "." || parent == javaExe {
		return "", false
	}

	home := filepath.Dir(parent)

	if home == "." || home == parent {
		return "", false
	}

	return filepath.Join(home, finalReleaseFileName), true
}

/*
 * finalBannerFromSpawn runs the runtime and returns whatever it printed about
 * itself. The bool reports whether the process could be started at all.
 *
 * Note that Rust passed CREATE_NO_WINDOW on Windows to stop a console window
 * from flashing. That flag lives in syscall.SysProcAttr, which is
 * platform-specific and cannot be set from a file that compiles for every
 * target, so it is left to a Windows-only file of the shared foundation.
 */
func finalBannerFromSpawn(javaExe string) (string, bool) {
	target := javaExe
	base := filepath.Base(javaExe)

	// 'javaw' is the console-less launcher: its banner goes nowhere readable, so
	// the sibling 'java' is preferred whenever it exists.
	if strings.TrimSuffix(base, filepath.Ext(base)) == finalJavaWindowedExecutable {
		sibling := filepath.Join(filepath.Dir(javaExe), finalJavaExecutable+finalExecutableSuffix())

		if finalIsRegularFile(sibling) {
			target = sibling
		}
	}

	// '-version' and not '--version': the double dash fails on Java 8 and older,
	// which is exactly the runtime most likely to be lying around.
	command := exec.Command(target, "-version")

	var output, failures bytes.Buffer

	command.Stdout = &output
	command.Stderr = &failures

	/*
	 * Rust used `Command::output()`, which only fails when the process cannot be
	 * started. A non-zero exit still carries a usable banner, and Go reports that
	 * case as *exec.ExitError, so it is not treated as a failure here either.
	 */
	if err := command.Run(); err != nil {
		var exit *exec.ExitError

		if !errors.As(err, &exit) {
			return "", false
		}
	}

	// Java prints '-version' on stderr, but not every build does.
	if strings.TrimSpace(failures.String()) != "" {
		return failures.String(), true
	}

	return output.String(), true
}

// finalMajorFromBanner reads the major version out of a startup banner.
func finalMajorFromBanner(banner string) *uint32 {
	version, described := finalVersionFromBanner(banner)

	if !described {
		return nil
	}

	return finalParseJavaMajor(version)
}

/*
 * finalVersionFromBanner extracts the quoted version of a startup banner:
 *
 *	openjdk version "25.0.1" 2025-10-21 LTS
 *	java version "1.8.0_472"
 */
func finalVersionFromBanner(banner string) (string, bool) {
	line, found := finalVersionLine(banner)

	if !found {
		return "", false
	}

	quoted := strings.Split(line, `"`)

	if len(quoted) < 2 {
		return "", false
	}

	return quoted[1], true
}

/*
 * finalVendorFromBanner guesses the vendor from the runtime name, because the
 * banner never states it:
 *
 *	openjdk version "25.0.1" -> OpenJDK
 *	java version "1.8.0_472" -> Oracle
 */
func finalVendorFromBanner(banner string) string {
	line, found := finalVersionLine(banner)

	if !found {
		return finalUnknownVendor
	}

	fields := strings.Fields(line)

	if len(fields) == 0 {
		return finalUnknownVendor
	}

	switch fields[0] {
	case "openjdk":
		return "OpenJDK"
	case "java":
		return "Oracle"
	default:
		return finalUnknownVendor
	}
}

// finalVersionLine is the first line of a banner that mentions a version. Java
// happily prints warnings before it, so the first line is not good enough.
func finalVersionLine(banner string) (string, bool) {
	for _, line := range finalTextLines(banner) {
		if strings.Contains(line, "version") {
			return line, true
		}
	}

	return "", false
}

/*
 * finalParseJavaMajor turns a version string into its major number:
 *
 *	"25.0.2"    -> 25
 *	"21"        -> 21
 *	"21.0.1+12" -> 21
 *	"1.8.0_472" -> 8
 */
func finalParseJavaMajor(version string) *uint32 {
	/*
	 * Rust split on a set of characters, which keeps the empty components that
	 * strings.Fields would drop. Mapping every separator onto '.' before
	 * splitting reproduces that, so a malformed "-21" stays unparseable instead
	 * of quietly becoming 21.
	 */
	normalised := strings.Map(func(symbol rune) rune {
		if symbol == '_' || symbol == '-' || symbol == '+' {
			return '.'
		}

		return symbol
	}, version)

	parts := strings.Split(normalised, ".")
	first, parsed := finalParseUint32(parts[0])

	if !parsed {
		return nil
	}

	// Java 8 and older reported "1.8.0_472", where the real major comes second.
	if first == 1 {
		if len(parts) < 2 {
			return nil
		}

		second, parsed := finalParseUint32(parts[1])

		if !parsed {
			return nil
		}

		return &second
	}

	return &first
}

func finalParseUint32(text string) (uint32, bool) {
	value, err := strconv.ParseUint(strings.TrimSpace(text), 10, 32)

	if err != nil {
		return 0, false
	}

	return uint32(value), true
}

// finalJavaDirectoryRoots lists the directories vendors install JDKs into. Each
// direct child is treated as a JDK home.
func finalJavaDirectoryRoots() []string {
	switch runtime.GOOS {
	case "windows":
		vendors := []string{
			"Java",
			"Eclipse Adoptium",
			"Zulu",
			"Amazon Corretto",
			"BellSoft",
			"Microsoft",
		}
		roots := make([]string, 0, 2*len(vendors)+1)

		// Both Program Files trees are scanned, so a 32-bit JDK on a 64-bit
		// Windows is found too.
		for _, variable := range []string{"ProgramFiles", "ProgramFiles(x86)"} {
			base, declared := os.LookupEnv(variable)

			if !declared {
				continue
			}

			for _, vendor := range vendors {
				roots = append(roots, filepath.Join(base, vendor))
			}
		}

		// Adoptium's per-user installation needs no administrator rights and is
		// therefore common.
		if local, declared := os.LookupEnv("LOCALAPPDATA"); declared {
			roots = append(roots, filepath.Join(local, "Programs", "Eclipse Adoptium"))
		}

		return roots
	case "darwin":
		return []string{
			"/Library/Java/JavaVirtualMachines",
			"/System/Library/Java/JavaVirtualMachines",
			// Homebrew keeps its casks here, on Apple silicon and on Intel.
			"/opt/homebrew/opt",
			"/usr/local/opt",
		}
	default:
		return []string{
			"/usr/lib/jvm",
			"/usr/lib64/jvm",
			"/usr/java",
			"/opt/java",
		}
	}
}

// finalExecutableSuffix is Rust's `std::env::consts::EXE_SUFFIX`.
func finalExecutableSuffix() string {
	if runtime.GOOS == "windows" {
		return ".exe"
	}

	return ""
}

// finalIsRegularFile mirrors Rust's `Path::is_file()`: it follows symlinks and
// accepts nothing but a regular file, so a directory named 'java' is refused.
func finalIsRegularFile(path string) bool {
	info, err := os.Stat(path)

	return err == nil && info.Mode().IsRegular()
}

// finalTextLines splits text the way Rust's `str::lines()` does: on '\n', with a
// trailing '\r' removed, so a CRLF release file parses identically everywhere.
func finalTextLines(text string) []string {
	lines := strings.Split(text, "\n")

	for index, line := range lines {
		lines[index] = strings.TrimSuffix(line, "\r")
	}

	return lines
}

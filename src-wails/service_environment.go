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

/**
 * ATTENTION: AI-generated (by Claude Opus 5 on 'max' reasoning)
 */

package main

import (
	"os"
	"runtime"
	"strings"
	"sync"
)

/*
 * EnvironmentService replaces tauri-plugin-os.
 *
 * The frontend never awaits the OS plugin: Tauri injected the values into
 * `window.__TAURI_OS_PLUGIN_INTERNALS__` before the webview loaded, and the
 * plugin's functions read that object synchronously. The bridge fetches this
 * report once during boot and fills the same shim, which is why every field is
 * phrased in Tauri's vocabulary rather than Go's.
 */

// envUnknownValue is what Tauri's os plugin reports for a value it cannot
// determine.
const envUnknownValue = "unknown"

// The OsType / Platform vocabulary of the os plugin.
const (
	envWindows = "windows"
	envMacOS   = "macos"
	envLinux   = "linux"
)

// The OsFamily vocabulary of the os plugin: Rust only knows these two.
const (
	envFamilyWindows = "windows"
	envFamilyUnix    = "unix"
)

/*
 * envArchitectures maps GOARCH onto `std::env::consts::ARCH`, which is what the
 * os plugin returned. The names differ for the two architectures that actually
 * ship ("amd64" against "x86_64", "arm64" against "aarch64"), and the frontend
 * uses them to pick native libraries, so the mapping has to be Rust's.
 */
var envArchitectures = map[string]string{
	"386":     "x86",
	"amd64":   "x86_64",
	"arm":     "arm",
	"arm64":   "aarch64",
	"loong64": "loongarch64",
	"mips":    "mips",
	"mips64":  "mips64",
	"ppc64":   "powerpc64",
	"ppc64le": "powerpc64",
	"riscv64": "riscv64",
	"s390x":   "s390x",
	"wasm":    "wasm32",
}

/*
 * envOSVersion is resolved once. The answer cannot change while the process
 * runs, and the shim is refilled on every reload of the UI.
 */
var envOSVersion = sync.OnceValue(envDetectOSVersion)

// EnvInfo is the payload of the `window.__TAURI_OS_PLUGIN_INTERNALS__` shim.
type EnvInfo struct {
	OSType       string `json:"osType"`
	Platform     string `json:"platform"`
	Family       string `json:"family"`
	Version      string `json:"version"`
	Arch         string `json:"arch"`
	ExeExtension string `json:"exeExtension"`
	EOL          string `json:"eol"`
	Separator    string `json:"separator"`
	Delimiter    string `json:"delimiter"`
	AppVersion   string `json:"appVersion"`
}

type EnvironmentService struct{}

func newEnvironmentService() *EnvironmentService {
	return &EnvironmentService{}
}

// Info describes the host the launcher is running on.
func (e *EnvironmentService) Info() EnvInfo {
	platform := envPlatform()

	return EnvInfo{
		// The os plugin exposes the same value under two names: `type()` and
		// `platform()` only differ on mobile, which this launcher does not target.
		OSType:       platform,
		Platform:     platform,
		Family:       envFamily(),
		Version:      envOSVersion(),
		Arch:         envArchitecture(),
		ExeExtension: envExecutableExtension(),
		EOL:          envLineEnding(),
		// Both separators come from the standard library, so a Windows build
		// reports '\\' and ';' without any conditional here.
		Separator:  string(os.PathSeparator),
		Delimiter:  string(os.PathListSeparator),
		AppVersion: launcherVersion,
	}
}

/*
 * envPlatform names the operating system the way Tauri does. 'darwin' is
 * reported as 'macos', and every other unix-like target reports 'linux', which
 * is what the os plugin did for the BSDs as well.
 */
func envPlatform() string {
	switch runtime.GOOS {
	case "windows":
		return envWindows
	case "darwin":
		return envMacOS
	default:
		return envLinux
	}
}

func envFamily() string {
	if runtime.GOOS == "windows" {
		return envFamilyWindows
	}

	return envFamilyUnix
}

func envArchitecture() string {
	if architecture, mapped := envArchitectures[runtime.GOARCH]; mapped {
		return architecture
	}

	// An architecture nobody builds for yet still gets a plausible answer:
	// GOARCH and ARCH agree for most of the remaining targets.
	return runtime.GOARCH
}

// envExecutableExtension is the extension the frontend appends to an executable
// name, so it carries the leading dot and can be concatenated as it is.
func envExecutableExtension() string {
	if runtime.GOOS == "windows" {
		return ".exe"
	}

	return ""
}

func envLineEnding() string {
	if runtime.GOOS == "windows" {
		return "\r\n"
	}

	return "\n"
}

/*
 * envDetectOSVersion reports the OS version without starting a process.
 *
 * Tauri asked `os_info`, which reads the registry on Windows and shells out to
 * `sw_vers` on macOS. Neither is reachable from a file that compiles for every
 * target, and spawning a helper would flash a console window on Windows, so
 * only the cheap single-file sources are used. The value is informational (it
 * ends up in logs and in the about screen), which makes "unknown" an acceptable
 * answer.
 */
func envDetectOSVersion() string {
	switch runtime.GOOS {
	case "linux":
		// The kernel release, for example "6.12.76".
		release, err := os.ReadFile("/proc/sys/kernel/osrelease")

		if err != nil {
			return envUnknownValue
		}

		if version := strings.TrimSpace(string(release)); version != "" {
			return version
		}
	case "darwin":
		if version := envMacOSProductVersion(); version != "" {
			return version
		}
	}

	return envUnknownValue
}

/*
 * envMacOSProductVersion reads ProductVersion (for example "15.3") out of the
 * plist every macOS installation ships. The file is XML and the value follows
 * its key, so a targeted scan avoids pulling a plist parser in for one string.
 */
func envMacOSProductVersion() string {
	content, err := os.ReadFile("/System/Library/CoreServices/SystemVersion.plist")

	if err != nil {
		return ""
	}

	_, afterKey, found := strings.Cut(string(content), "<key>ProductVersion</key>")

	if !found {
		return ""
	}

	_, afterOpeningTag, found := strings.Cut(afterKey, "<string>")

	if !found {
		return ""
	}

	version, _, found := strings.Cut(afterOpeningTag, "</string>")

	if !found {
		return ""
	}

	return strings.TrimSpace(version)
}

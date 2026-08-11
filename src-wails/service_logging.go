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
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

/*
 * The Go counterpart of `logging.rs` plus the `plugin:log|log` endpoint of the
 * Tauri log plugin, which together fed the in-app log viewer.
 *
 * The Rust split the work between two crates: the log plugin appended every
 * record to `<logs dir>/latest.log`, and `logging.rs` tailed that same file back
 * into the webview. Both halves live here, and the tail is kept in memory
 * instead of being re-read from disk every 100 ms -- see `logsvcSince`.
 */

const (
	// logsvcTick is the Rust `TICK`: the tail polls ten times a second.
	logsvcTick = 100 * time.Millisecond

	// logsvcDelimiter is `LogInfo.delimiter` from `src/constants/browser.ts`.
	// `src/lib/logging/parser.ts` splits on exactly this string, so a line only
	// renders as structured when it uses it.
	logsvcDelimiter = " | "

	// logsvcTimeLayout is the timestamp of the `.format` closure in `lib.rs`:
	// `{:02}:{:02}:{:02}.{:03}` over `OffsetDateTime::now_utc`.
	logsvcTimeLayout = "15:04:05.000"

	// logsvcAppName is the `APP_NAME` constant, which also names the launcher's
	// data directory.
	logsvcAppName = "kaede"

	// logsvcFileName is the log plugin's `TargetKind::Folder` file name.
	logsvcFileName = "latest.log"

	// logsvcMaxFileSize is the plugin's `max_file_size`.
	logsvcMaxFileSize = 8 * 1024 * 1024

	/*
	 * logsvcTailCapacity bounds the in-memory tail.
	 *
	 * The Rust snapshot was the whole log file, which the plugin capped at
	 * 8 MiB; a line budget bounds this port the same way without measuring
	 * bytes. Dropping the oldest lines is what makes the `truncated` event
	 * reachable, exactly as a rotated file did on the Rust side.
	 */
	logsvcTailCapacity = 32768
)

// The `LogStreamEvent` variants, camelCased by `rename_all`.
const (
	logsvcEventSnapshot  = "snapshot"
	logsvcEventLines     = "lines"
	logsvcEventTruncated = "truncated"
)

// logsvcLevelNames is `LogInfo.levels`: the numeric levels the frontend sends
// map onto the names `log::Level` used to print. Index 0 is unused.
var logsvcLevelNames = [6]string{"", "TRACE", "DEBUG", "INFO", "WARN", "ERROR"}

/*
 * logsvcStreamEvent is the adjacently tagged Rust `LogStreamEvent`.
 *
 * `Data` is a pointer because the unit variant `Truncated` serialized as an
 * object carrying nothing but the tag, while an empty `Snapshot` still had to
 * serialize as `[]`: only a nil pointer drops the key, whereas a pointer to an
 * empty slice keeps it.
 */
type logsvcStreamEvent struct {
	Type string    `json:"type"`
	Data *[]string `json:"data,omitempty"`
}

// LoggingService replaces the `LogTail` managed state and owns the log file the
// plugin used to own.
type LoggingService struct {
	// path is `<logs dir>/latest.log`, the Rust `LogTail::path`.
	path string

	// mutex guards the in-memory tail and the active stream.
	mutex   sync.Mutex
	lines   []string
	dropped uint64
	seeded  bool
	current chan struct{}

	// fileMutex guards the append target. It is separate from `mutex` so that a
	// slow disk cannot hold up the tail the webview is reading.
	fileMutex sync.Mutex
	file      *os.File
	fileSize  int64
}

// newLoggingService resolves the log file path the way `lib.rs` setup did. The
// directory itself is created lazily, when the first line needs writing.
func newLoggingService() *LoggingService {
	return &LoggingService{path: filepath.Join(logsvcLogsDirectory(), logsvcFileName)}
}

// StreamLogs is `stream_logs`. It sends a `snapshot`, then `lines` and
// `truncated` messages as the tail changes, and only returns once the stream is
// stopped -- either by `StopLogStream` or by a newer `StreamLogs` superseding it.
func (l *LoggingService) StreamLogs(streamID string) error {
	// `state.begin()` came first in the Rust, so a new stream supersedes the old
	// one even when the initial read then fails.
	stopped := l.logsvcBegin()

	lines, offset, err := l.logsvcCurrent()

	if err != nil {
		return err
	}

	emitStream(streamID, logsvcPayloadEvent(logsvcEventSnapshot, lines))

	ticker := time.NewTicker(logsvcTick)
	defer ticker.Stop()

	for {
		select {
		case <-stopped:
			// The Rust noticed the stop flag on the next tick; returning right
			// away resolves the pending promise sooner and never later.
			return nil
		case <-ticker.C:
		}

		lines, next, truncated := l.logsvcSince(offset)

		switch {
		case truncated:
			// The tail no longer reaches back that far: tell the webview to
			// clear its buffer and resume from what is still held, which is what
			// resetting the file offset to zero achieved in Rust.
			offset = next

			emitStream(streamID, logsvcStreamEvent{Type: logsvcEventTruncated})
		case len(lines) == 0:
			continue
		default:
			offset = next

			emitStream(streamID, logsvcPayloadEvent(logsvcEventLines, lines))
		}
	}
}

// StopLogStream is `stop_log_stream`: it ends the active tail and reports
// whether there was one.
func (l *LoggingService) StopLogStream() bool {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	if l.current == nil {
		return false
	}

	close(l.current)
	l.current = nil

	return true
}

// WriteLog backs `plugin:log|log`, which is how every `log.*` call in the
// frontend reaches the backend.
//
// The plugin formatted the record, appended it to `latest.log` and let the tail
// pick it up again; here the formatted line goes to the tail directly and to the
// file for the next session to read.
func (l *LoggingService) WriteLog(level int, location string, message string) {
	/*
	 * The target is `webview:<location>`, where the location is the caller's
	 * pre-bundled file name. `src/lib/logging/scopes/get-log-target-color.ts`
	 * colours lines by that exact prefix.
	 */
	line := strings.Join([]string{
		time.Now().UTC().Format(logsvcTimeLayout),
		logsvcLevelName(level),
		"webview:" + location,
		message,
	}, logsvcDelimiter)

	l.logsvcAppend(line)
	l.logsvcWriteFile(line)
}

// logsvcBegin is `LogTail::begin`: starting a stream stops the previous one, so
// at most one tail is ever active.
func (l *LoggingService) logsvcBegin() <-chan struct{} {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	if l.current != nil {
		close(l.current)
	}

	l.current = make(chan struct{})

	return l.current
}

// logsvcCurrent returns everything the tail holds plus the position to resume
// from, which is the snapshot the Rust built from the file contents.
func (l *LoggingService) logsvcCurrent() ([]string, uint64, error) {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	if err := l.logsvcSeedLocked(); err != nil {
		return nil, 0, err
	}

	lines := make([]string, len(l.lines))
	copy(lines, l.lines)

	return lines, l.dropped + uint64(len(l.lines)), nil
}

/*
 * logsvcSince reports the lines recorded after the absolute position `from`,
 * the position to resume from, and whether the tail has moved past `from`.
 *
 * Absolute positions (lines ever recorded, not indices into the buffer) are the
 * in-memory equivalent of the byte offset the Rust tracked in the file, and the
 * `truncated` result is the equivalent of noticing that the file had shrunk.
 */
func (l *LoggingService) logsvcSince(from uint64) ([]string, uint64, bool) {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	total := l.dropped + uint64(len(l.lines))

	if from < l.dropped || from > total {
		return nil, l.dropped, true
	}

	if from == total {
		return nil, total, false
	}

	// A copy, because the caller emits it after releasing the lock.
	pending := make([]string, total-from)
	copy(pending, l.lines[from-l.dropped:])

	return pending, total, false
}

// logsvcAppend records a formatted line. A multi-line message becomes one tail
// entry per physical line, which is what the file-backed tail delivered.
func (l *LoggingService) logsvcAppend(line string) {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	// A failure here is ignored: the seed only adds history, and `WriteLog` has
	// no way to report anything.
	_ = l.logsvcSeedLocked()

	l.lines = append(l.lines, logsvcSplitLines([]byte(line))...)
	l.logsvcTrimLocked()
}

// logsvcSeedLocked fills the tail from `latest.log` once.
//
// The Rust snapshot came from that file, so a stream opened after a webview
// reload showed whatever the current session had already logged. Reading it once
// preserves that while keeping every later message in memory. A missing file is
// an empty one, exactly as `NotFound` was.
func (l *LoggingService) logsvcSeedLocked() error {
	if l.seeded {
		return nil
	}

	contents, err := os.ReadFile(l.path)

	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			// Left unseeded on purpose: the Rust rejected such a read too, and
			// the next stream should try again.
			return err
		}

		l.seeded = true

		return nil
	}

	l.seeded = true

	// Everything up to the last complete line; a trailing partial line is
	// deliberately excluded, so that it is delivered once it is finished.
	if end := bytes.LastIndexByte(contents, '\n'); end >= 0 {
		l.lines = append(l.lines, logsvcSplitLines(contents[:end+1])...)
		l.logsvcTrimLocked()
	}

	return nil
}

// logsvcTrimLocked evicts the oldest lines once the tail is full, counting them
// so that positions handed out earlier stay meaningful.
func (l *LoggingService) logsvcTrimLocked() {
	extra := len(l.lines) - logsvcTailCapacity

	if extra <= 0 {
		return
	}

	l.lines = append(l.lines[:0], l.lines[extra:]...)
	l.dropped += uint64(extra)
}

// logsvcWriteFile appends one line to `latest.log`. Logging must never fail its
// caller, so every error here is swallowed after resetting the handle, which
// lets the next line reopen the file.
func (l *LoggingService) logsvcWriteFile(line string) {
	l.fileMutex.Lock()
	defer l.fileMutex.Unlock()

	payload := line + "\n"

	if err := l.logsvcOpenLocked(int64(len(payload))); err != nil {
		return
	}

	written, err := l.file.WriteString(payload)
	l.fileSize += int64(written)

	if err != nil {
		l.logsvcCloseLocked()
	}
}

// logsvcOpenLocked makes sure the log file is open and has room for `incoming`
// more bytes. The size check also covers a file this session inherited, for
// instance when startup could not rotate it.
func (l *LoggingService) logsvcOpenLocked(incoming int64) error {
	if l.file == nil {
		if err := l.logsvcReopenLocked(); err != nil {
			return err
		}
	}

	// The `fileSize > 0` guard matters for a single line longer than the cap: it
	// is written to a fresh file rather than rotating the file forever.
	if l.fileSize > 0 && l.fileSize+incoming > logsvcMaxFileSize {
		l.logsvcRotateLocked()

		return l.logsvcReopenLocked()
	}

	return nil
}

// logsvcReopenLocked opens `latest.log` for appending, creating the logs
// directory the way `lib.rs` setup did, and picks up the size it already has.
func (l *LoggingService) logsvcReopenLocked() error {
	if err := os.MkdirAll(filepath.Dir(l.path), 0o755); err != nil {
		return err
	}

	file, err := os.OpenFile(l.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)

	if err != nil {
		return err
	}

	l.file = file
	l.fileSize = 0

	if info, err := file.Stat(); err == nil {
		l.fileSize = info.Size()
	}

	return nil
}

// logsvcRotateLocked keeps `latest.log` under the plugin's 8 MiB cap. The
// plugin's `RotationStrategy::KeepAll` renamed the full file rather than
// discarding it, so the name carries the moment of the rotation. The name also
// stays clear of the `kaede-{number}.log` scheme that startup rotation uses.
func (l *LoggingService) logsvcRotateLocked() {
	l.logsvcCloseLocked()

	rotated := filepath.Join(
		filepath.Dir(l.path),
		strings.TrimSuffix(logsvcFileName, ".log")+"_"+time.Now().UTC().Format("20060102T150405Z")+".log",
	)

	_ = os.Rename(l.path, rotated)
}

// logsvcCloseLocked drops the current handle.
func (l *LoggingService) logsvcCloseLocked() {
	if l.file == nil {
		return
	}

	_ = l.file.Close()

	l.file = nil
	l.fileSize = 0
}

// logsvcPayloadEvent builds one of the two variants that carry data. The slice
// is never nil, so an empty snapshot still serializes as `[]` rather than null.
func logsvcPayloadEvent(kind string, lines []string) logsvcStreamEvent {
	if lines == nil {
		lines = []string{}
	}

	return logsvcStreamEvent{Type: kind, Data: &lines}
}

// logsvcLevelName maps a numeric level onto its name. The plugin capped logging
// at `Debug` and would have refused a level outside 1..=5 outright; clamping
// instead keeps the line parseable, and the frontend only ever sends 2..=5.
func logsvcLevelName(level int) string {
	if level < 1 {
		level = 1
	}

	if level >= len(logsvcLevelNames) {
		level = len(logsvcLevelNames) - 1
	}

	return logsvcLevelNames[level]
}

// logsvcSplitLines is `String::from_utf8_lossy(..).lines()`: lossy UTF-8, split
// on newlines, each trailing carriage return stripped, and no empty entry after
// a final newline.
func logsvcSplitLines(data []byte) []string {
	text := strings.ToValidUTF8(string(data), "\uFFFD")
	text = strings.TrimSuffix(text, "\n")

	if text == "" {
		return nil
	}

	lines := strings.Split(text, "\n")

	for index, line := range lines {
		lines[index] = strings.TrimSuffix(line, "\r")
	}

	return lines
}

// logsvcLogsDirectory resolves the directory `lib.rs` setup computed: the
// launcher executable's own directory in portable mode -- flagged by a
// `portable.txt` next to it, the Prism Launcher convention `is_portable` used --
// and Tauri's app data directory otherwise.
func logsvcLogsDirectory() string {
	if executable, err := os.Executable(); err == nil {
		parent := filepath.Dir(executable)

		if _, err := os.Stat(filepath.Join(parent, "portable.txt")); err == nil {
			return filepath.Join(parent, "logs")
		}
	}

	return filepath.Join(logsvcDataDirectory(), logsvcAppName, "logs")
}

/*
 * logsvcDataDirectory is Tauri's `app_data_dir` minus the bundle identifier,
 * which `dirs::data_dir` resolved.
 *
 * On Windows and macOS that is `%APPDATA%` and `~/Library/Application Support`,
 * both of which `os.UserConfigDir` already reports. Everywhere else it is the
 * XDG *data* directory, `~/.local/share`, where `os.UserConfigDir` would answer
 * `~/.config` instead -- hence the split.
 */
func logsvcDataDirectory() string {
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" {
		if directory := os.Getenv("XDG_DATA_HOME"); filepath.IsAbs(directory) {
			return directory
		}

		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".local", "share")
		}
	} else if directory, err := os.UserConfigDir(); err == nil {
		return directory
	}

	// A last resort that is always writable, so the launcher still logs.
	return os.TempDir()
}

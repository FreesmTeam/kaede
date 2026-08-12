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
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

/*
 * The Go counterpart of `processes.rs`, which ran managed child processes on
 * top of `tauri-plugin-shellx`.
 *
 * The Rust side received one `CommandEvent` per line from the plugin and
 * batched those lines into `process-output` events. This file keeps the same
 * shape: two line readers feed a single event channel, and one pump goroutine
 * turns that channel into the very Tauri events the frontend already listens
 * for in `src/lib/watchers/watch-processes.ts`.
 */

// procTick mirrors the Rust `TICK`. Output is flushed at most ten times a
// second, so a chatty child (a Minecraft instance replaying its whole log)
// cannot drown the webview in individual events.
const procTick = 100 * time.Millisecond

// The two `Program` variants. serde renamed them, so the wire values are
// lowercase.
const (
	procProgramPath    = "path"
	procProgramSidecar = "sidecar"
)

// The `CommandEvent` variants this port cares about. shellx's enum is
// `#[non_exhaustive]` and the Rust ignored everything else.
const (
	procEventLine       = "line"
	procEventFailure    = "failure"
	procEventTerminated = "terminated"
)

// procEventBuffer keeps the readers from stalling on the pump between two
// flushes. shellx used a channel of capacity one, so this is strictly more
// forgiving while keeping the same back pressure once the buffer is full.
const procEventBuffer = 256

// ProcProgram is the adjacently tagged Rust `Program` enum: the tag lives in
// `type` and the payload in `value`.
type ProcProgram struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// ProcSpawnSpec is `SpawnSpec`. The struct carries `rename_all = "camelCase"`,
// and every field is a single word, so the Rust names are already the wire
// names. `args`, `cwd`, `env` and `meta` were `#[serde(default)]`, which the
// zero values reproduce.
type ProcSpawnSpec struct {
	Token   string            `json:"token"`
	Program ProcProgram       `json:"program"`
	Args    []string          `json:"args"`
	Cwd     *string           `json:"cwd"`
	Env     map[string]string `json:"env"`
	Kind    string            `json:"kind"`
	Meta    any               `json:"meta"`
}

// ProcRunSpec is `RunSpec`: a one-shot run, so it has no token, kind or meta.
type ProcRunSpec struct {
	Program ProcProgram       `json:"program"`
	Args    []string          `json:"args"`
	Cwd     *string           `json:"cwd"`
	Env     map[string]string `json:"env"`
}

// ProcDto is `ProcessDto`. `meta` is an opaque passthrough and must survive as
// `null` when the caller sent nothing, which is why it is not omitted.
type ProcDto struct {
	Token string `json:"token"`
	Pid   uint32 `json:"pid"`
	Kind  string `json:"kind"`
	Meta  any    `json:"meta"`
}

// ProcRunResult is `RunResult`. `code` is null when the child was terminated by
// a signal, mirroring `Option<i32>`.
type ProcRunResult struct {
	Code    *int32 `json:"code"`
	Success bool   `json:"success"`
	Stdout  string `json:"stdout"`
	Stderr  string `json:"stderr"`
}

// procOutputPayload is the `process-output` payload.
type procOutputPayload struct {
	Token  string   `json:"token"`
	Pid    uint32   `json:"pid"`
	Stream string   `json:"stream"`
	Lines  []string `json:"lines"`
}

// procErrorPayload is the `process-error` payload.
type procErrorPayload struct {
	Token   string `json:"token"`
	Pid     uint32 `json:"pid"`
	Message string `json:"message"`
}

// procExitPayload is the `process-exited` payload.
type procExitPayload struct {
	Token  string `json:"token"`
	Pid    uint32 `json:"pid"`
	Kind   string `json:"kind"`
	Code   *int32 `json:"code"`
	Signal *int32 `json:"signal"`
}

// procEvent is the Go stand-in for shellx's `CommandEvent`. A flat struct with
// a kind beats several channel types here, because the pump has to preserve the
// order in which output, failures and the termination arrived.
type procEvent struct {
	kind    string
	stream  string
	line    string
	message string
	code    *int32
	signal  *int32
}

// procEntry is `ProcessEntry`. `stdin` is kept because the Rust `CommandChild`
// owned the writing half of the child's stdin pipe.
type procEntry struct {
	token      string
	kind       string
	meta       any
	command    *exec.Cmd
	stdin      io.WriteCloser
	stdinMutex sync.Mutex
}

// ProcessService is the `ProcessRegistry` managed state, keyed by pid exactly
// like the Rust `HashMap<u32, ProcessEntry>`.
type ProcessService struct {
	mutex   sync.Mutex
	entries map[uint32]*procEntry
}

// newProcessService builds the empty registry that `.manage(ProcessRegistry::default())` used to install.
func newProcessService() *ProcessService {
	return &ProcessService{entries: make(map[uint32]*procEntry)}
}

// SpawnProcess is `spawn_process`. It starts the child, registers it under its
// pid and returns the DTO; everything the child prints afterwards arrives as
// `process-output`, `process-error` and `process-exited` events.
func (p *ProcessService) SpawnProcess(spec ProcSpawnSpec) (ProcDto, error) {
	command, err := procCommand(spec.Program, spec.Args, spec.Cwd, spec.Env)

	if err != nil {
		return ProcDto{}, err
	}

	// The Rust child always owned all three pipes: `write_process` needs stdin,
	// and the event stream needs both output pipes.
	stdin, err := command.StdinPipe()

	if err != nil {
		return ProcDto{}, err
	}

	stdout, err := command.StdoutPipe()

	if err != nil {
		return ProcDto{}, err
	}

	stderr, err := command.StderrPipe()

	if err != nil {
		return ProcDto{}, err
	}

	if err := command.Start(); err != nil {
		return ProcDto{}, err
	}

	pid := uint32(command.Process.Pid)
	entry := &procEntry{
		token:   spec.Token,
		kind:    spec.Kind,
		meta:    spec.Meta,
		command: command,
		stdin:   stdin,
	}

	p.mutex.Lock()
	p.entries[pid] = entry
	p.mutex.Unlock()

	go p.procPump(entry, pid, stdout, stderr)

	return ProcDto{Token: spec.Token, Pid: pid, Kind: spec.Kind, Meta: spec.Meta}, nil
}

// ListProcesses is `list_processes`. Map iteration order is arbitrary, just as
// it was for the Rust `HashMap`; `rehydrateProcesses` does not care about order.
func (p *ProcessService) ListProcesses() []ProcDto {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	// Never nil: the frontend calls `.map` on the result, and `null` would
	// throw before it ever reached the rehydration code.
	dtos := make([]ProcDto, 0, len(p.entries))

	for pid, entry := range p.entries {
		dtos = append(dtos, ProcDto{
			Token: entry.token,
			Pid:   pid,
			Kind:  entry.kind,
			Meta:  entry.meta,
		})
	}

	return dtos
}

// KillProcess is `kill_process`. The entry is dropped from the registry before
// the kill is attempted, exactly like the Rust, so a pid that cannot be killed
// still disappears from `list_processes`. The pump keeps running and still
// reports `process-exited` once the child is reaped.
func (p *ProcessService) KillProcess(pid uint32) error {
	entry := p.procTake(pid)

	if entry == nil {
		return fmt.Errorf("no managed process with pid %d", pid)
	}

	if entry.command.Process == nil {
		return fmt.Errorf("no managed process with pid %d", pid)
	}

	return entry.command.Process.Kill()
}

// WriteProcess is `write_process`. No newline is appended: the caller decides.
func (p *ProcessService) WriteProcess(pid uint32, data any) error {
	// The payload is decoded first because the Rust decoded its `StdinData`
	// argument before the command body ever looked at the registry.
	payload, err := procStdinBytes(data)

	if err != nil {
		return err
	}

	entry := p.procLookup(pid)

	if entry == nil {
		return fmt.Errorf("no managed process with pid %d", pid)
	}

	/*
	 * The Rust held the registry mutex across the write. Here a per-entry lock
	 * serialises writers instead, so a child that stopped draining its stdin
	 * cannot block `list_processes` or another spawn behind a full pipe.
	 */
	entry.stdinMutex.Lock()
	defer entry.stdinMutex.Unlock()

	_, err = entry.stdin.Write(payload)

	return err
}

// RunProcess is `run_process`: a one-shot run that buffers both streams and is
// never registered. A non-zero exit code is not an error, it surfaces as
// `success: false`.
func (p *ProcessService) RunProcess(spec ProcRunSpec) (ProcRunResult, error) {
	command, err := procCommand(spec.Program, spec.Args, spec.Cwd, spec.Env)

	if err != nil {
		return ProcRunResult{}, err
	}

	var stdout, stderr bytes.Buffer

	command.Stdout = &stdout
	command.Stderr = &stderr

	err = command.Run()

	// Only a failure to spawn or to wait is an error; `exec.ExitError` merely
	// means the child ran and reported a non-zero status.
	var exitError *exec.ExitError

	if err != nil && !errors.As(err, &exitError) {
		return ProcRunResult{}, err
	}

	code, _ := procExitStatus(command.ProcessState)

	return ProcRunResult{
		Code:    code,
		Success: command.ProcessState.Success(),
		// Unlike the spawned-process path, line endings are preserved here:
		// `fetch-java-major.ts` reads the raw `java -version` banner.
		Stdout: procLossyString(stdout.Bytes()),
		Stderr: procLossyString(stderr.Bytes()),
	}, nil
}

// procPump is the Rust background task: it batches output, forwards failures
// and reports the exit, in the order the child produced them.
func (p *ProcessService) procPump(entry *procEntry, pid uint32, stdout io.ReadCloser, stderr io.ReadCloser) {
	events := make(chan procEvent, procEventBuffer)

	var readers sync.WaitGroup

	readers.Add(2)

	go procReadLines(stdout, "stdout", events, &readers)
	go procReadLines(stderr, "stderr", events, &readers)

	go func() {
		/*
		 * shellx reported `Terminated` only once both pipes had hit EOF, which
		 * is what guaranteed that the final flush drained every line before the
		 * exit event. Waiting for both readers here reproduces that ordering --
		 * and `exec` requires it anyway, since `Wait` closes the pipes.
		 */
		readers.Wait()

		err := entry.command.Wait()

		var exitError *exec.ExitError

		if err != nil && !errors.As(err, &exitError) {
			// The Rust turned a failed wait into `CommandEvent::Error`, with no
			// termination event and no registry cleanup.
			events <- procEvent{kind: procEventFailure, message: err.Error()}
			close(events)

			return
		}

		code, signal := procExitStatus(entry.command.ProcessState)
		events <- procEvent{kind: procEventTerminated, code: code, signal: signal}

		close(events)
	}()

	var stdoutPending, stderrPending []string

	flush := func() {
		// stdout first, then stderr, and a stream with nothing pending emits
		// nothing at all -- the Rust `flush_output` in full.
		for _, batch := range []struct {
			stream  string
			pending *[]string
		}{{"stdout", &stdoutPending}, {"stderr", &stderrPending}} {
			if len(*batch.pending) == 0 {
				continue
			}

			emitTauriEvent("process-output", procOutputPayload{
				Token:  entry.token,
				Pid:    pid,
				Stream: batch.stream,
				Lines:  *batch.pending,
			})

			*batch.pending = nil
		}
	}

	ticker := time.NewTicker(procTick)
	defer ticker.Stop()

	for {
		select {
		case event, open := <-events:
			if !open {
				flush()

				return
			}

			switch event.kind {
			case procEventLine:
				if event.stream == "stdout" {
					stdoutPending = append(stdoutPending, event.line)
				} else {
					stderrPending = append(stderrPending, event.line)
				}
			case procEventFailure:
				// Anything printed before the failure arrives before it.
				flush()
				emitTauriEvent("process-error", procErrorPayload{
					Token:   entry.token,
					Pid:     pid,
					Message: event.message,
				})
			case procEventTerminated:
				flush()
				p.procForget(pid)
				emitTauriEvent("process-exited", procExitPayload{
					Token:  entry.token,
					Pid:    pid,
					Kind:   entry.kind,
					Code:   event.code,
					Signal: event.signal,
				})
			}
		case <-ticker.C:
			// `flush` skips empty buffers, which is the Rust tick guard.
			flush()
		}
	}
}

// procTake removes an entry and hands it over, like `HashMap::remove`.
func (p *ProcessService) procTake(pid uint32) *procEntry {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	entry, found := p.entries[pid]

	if !found {
		return nil
	}

	delete(p.entries, pid)

	return entry
}

// procForget drops an entry without caring whether it was still there, which is
// what the Rust removal on `Terminated` amounted to after a `kill_process`.
func (p *ProcessService) procForget(pid uint32) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	delete(p.entries, pid)
}

// procLookup returns the live entry for a pid, or nil.
func (p *ProcessService) procLookup(pid uint32) *procEntry {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	return p.entries[pid]
}

// procReadLines mirrors the shellx line reader: every newline-terminated chunk
// becomes one event, and so does a trailing fragment at EOF.
func procReadLines(pipe io.ReadCloser, stream string, events chan<- procEvent, readers *sync.WaitGroup) {
	defer readers.Done()
	defer pipe.Close()

	/*
	 * `bufio.Reader.ReadBytes` rather than a `Scanner`: a scanner refuses
	 * tokens longer than its buffer, and a Java stack trace printed without a
	 * newline would then kill the whole output stream.
	 */
	reader := bufio.NewReader(pipe)

	for {
		chunk, err := reader.ReadBytes('\n')

		if len(chunk) > 0 {
			events <- procEvent{kind: procEventLine, stream: stream, line: procIntoLine(chunk)}
		}

		if err != nil {
			if !errors.Is(err, io.EOF) {
				events <- procEvent{kind: procEventFailure, message: err.Error()}
			}

			return
		}
	}
}

// procIntoLine is the Rust `into_line`: lossy UTF-8, then every trailing CR and
// LF removed. Interior content is untouched.
func procIntoLine(chunk []byte) string {
	return strings.TrimRight(procLossyString(chunk), "\r\n")
}

// procLossyString stands in for `String::from_utf8_lossy`. Doing it here rather
// than leaving it to the JSON encoder keeps the replacement explicit, and the
// payload valid UTF-8 whatever the child printed.
func procLossyString(data []byte) string {
	return strings.ToValidUTF8(string(data), "\uFFFD")
}

// procCommand builds the child from a spec, applying args, cwd and env the way
// the Rust chained `args`, `current_dir` and `envs`.
func procCommand(program ProcProgram, args []string, cwd *string, env map[string]string) (*exec.Cmd, error) {
	path, err := procResolveProgram(program)

	if err != nil {
		return nil, err
	}

	/*
	 * No `SysProcAttr` here. tauri-plugin-shellx hid the console window of a
	 * Windows child with CREATE_NO_WINDOW, but that flag only exists in the
	 * Windows `syscall.SysProcAttr`, so setting it would cost this package its
	 * portability. A GUI child (the launched game) is unaffected.
	 */
	command := exec.Command(path, args...)

	if cwd != nil {
		command.Dir = *cwd
	}

	if len(env) > 0 {
		// `command.envs(map)` added to the inherited environment instead of
		// replacing it, and `exec` lets later entries win, including on Windows
		// where names are compared case insensitively.
		command.Env = os.Environ()

		for name, value := range env {
			command.Env = append(command.Env, name+"="+value)
		}
	}

	return command, nil
}

// procResolveProgram turns a `Program` into an executable path.
func procResolveProgram(program ProcProgram) (string, error) {
	switch program.Type {
	case procProgramPath:
		// `shell().command(program)`: resolved through PATH, as the shellx
		// plugin was initialized with arbitrary programs allowed.
		return program.Value, nil
	case procProgramSidecar:
		return procSidecarPath(program.Value)
	default:
		// serde would have refused the payload outright; the port reports the
		// same class of failure as a plain error string.
		return "", fmt.Errorf("unknown program type '%s'", program.Type)
	}
}

// procSidecarPath resolves a bundled `externalBin`.
//
// Tauri strips the target triple when it installs `binaries/{name}-{triple}`,
// so at runtime `shell().sidecar(name)` looked for `{name}{EXE_SUFFIX}` next to
// the launcher executable. Rebuilding that path is all this port has to do; a
// missing file surfaces as a spawn failure, exactly as it did in Rust.
func procSidecarPath(name string) (string, error) {
	executable, err := os.Executable()

	if err != nil {
		return "", err
	}

	if runtime.GOOS == "windows" && filepath.Ext(name) == "" {
		name += ".exe"
	}

	return filepath.Join(filepath.Dir(executable), name), nil
}

// procWaitStatus is the portable slice of every platform's `syscall.WaitStatus`.
//
// Tauri filled the `signal` field behind `#[cfg(unix)]`. Build tags are out of
// the question here, but all three targets implement these two methods, and the
// Windows implementation answers `Signaled() == false` unconditionally -- which
// is precisely the `#[cfg(windows)] signal: None` branch of the Rust.
type procWaitStatus interface {
	Signaled() bool
	Signal() syscall.Signal
}

// procExitStatus maps a finished child onto shellx's `TerminatedPayload`:
// `code` is null when a signal killed the child, `signal` is null otherwise.
func procExitStatus(state *os.ProcessState) (*int32, *int32) {
	if state == nil {
		return nil, nil
	}

	if status, ok := state.Sys().(procWaitStatus); ok && status.Signaled() {
		signal := int32(status.Signal())

		return nil, &signal
	}

	code := int32(state.ExitCode())

	if code < 0 {
		// Neither exited nor signalled: nothing meaningful to report.
		return nil, nil
	}

	return &code, nil
}

// procStdinBytes decodes the `StdinData` argument. The Rust enum was untagged
// and tried `Text` first, so a JSON string is written as UTF-8 and a JSON array
// of byte values as raw bytes -- the two shapes `core.ts` produces.
func procStdinBytes(data any) ([]byte, error) {
	switch value := data.(type) {
	case string:
		return []byte(value), nil
	case []byte:
		return value, nil
	case []any:
		payload := make([]byte, 0, len(value))

		for _, item := range value {
			number, ok := procByteValue(item)

			if !ok {
				return nil, procErrStdinType
			}

			payload = append(payload, number)
		}

		return payload, nil
	default:
		return nil, procErrStdinType
	}
}

// procErrStdinType reports what serde reported when neither variant matched.
var procErrStdinType = errors.New("data did not match any variant of untagged enum StdinData")

// procByteValue accepts the two numeric shapes a JSON decoder can produce for
// an array element and rejects anything a Rust `u8` would have rejected.
func procByteValue(item any) (byte, bool) {
	switch number := item.(type) {
	case float64:
		if number < 0 || number > math.MaxUint8 || number != math.Trunc(number) {
			return 0, false
		}

		return byte(number), true
	case json.Number:
		parsed, err := number.Int64()

		if err != nil || parsed < 0 || parsed > math.MaxUint8 {
			return 0, false
		}

		return byte(parsed), true
	default:
		return 0, false
	}
}

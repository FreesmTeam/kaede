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
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

/*
 * DownloadService is the counterpart of `downloads.rs`, plus the
 * `plugin:upload|download` endpoint that shares its machinery.
 *
 * The zero value has to work, because main.go registers `&DownloadService{}`:
 * the cancel registry therefore lives in package scope rather than on the
 * service, exactly like the `CancelFlags` that Tauri kept in managed state.
 */
type DownloadService struct{}

const (
	/*
	 * dlConnectTimeout and dlReadTimeout are the two timeouts the Rust backend
	 * configured on its reqwest client. There is no total-request timeout: a
	 * 300 MiB modpack on a slow line is not an error.
	 *
	 * net/http can enforce the connect one directly, but it has no per-read
	 * deadline, so the read one is applied by a watchdog that aborts a request
	 * whose body has produced nothing for that long.
	 */
	dlConnectTimeout = 30 * time.Second
	dlReadTimeout    = 30 * time.Second

	// dlTickInterval is the snapshot cadence of the Rust ticker task. Speed is
	// reported as the delta over one tick scaled by dlSpeedFactor, which is the
	// same rough approximation the Rust and the browser replica settled on.
	dlTickInterval = 100 * time.Millisecond
	dlSpeedFactor  = 10

	// dlChunkSize is both the read window and the size of the buffered writer
	// standing in for Rust's `BufWriter`. It bounds how often the cancel flag is
	// consulted, since that happens once per chunk.
	dlChunkSize = 64 * 1024

	/*
	 * dlPartialSuffix names the temporary file a download streams into. A
	 * half-written artifact must never be visible under its final name: the
	 * launcher decides what to fetch by looking at which files exist.
	 */
	dlPartialSuffix = ".part"

	// dlDirectoryMode is the permission set for directories created on the way
	// to a destination file. It is irrelevant on Windows.
	dlDirectoryMode = 0o755
)

// dlErrCancelled marks a download that stopped because its batch was
// cancelled. Rust modelled it as a separate enum variant, and the distinction
// matters: a cancelled file is not a failed one.
var dlErrCancelled = errors.New("the download was cancelled")

// DlEntry is one item of work: an URL and the absolute path it belongs at.
type DlEntry struct {
	URL  string `json:"url"`
	Path string `json:"path"`
}

// DlFailure describes one file the batch could not fetch.
type DlFailure struct {
	URL   string `json:"url"`
	Path  string `json:"path"`
	Error string `json:"error"`
}

// DlReport is what a batch returns once every worker has stopped.
type DlReport struct {
	Success   int         `json:"success"`
	Failed    int         `json:"failed"`
	Cancelled bool        `json:"cancelled"`
	Failures  []DlFailure `json:"failures"`
}

/*
 * dlSnapshot is one progress message. `current` holds only the files in flight,
 * keyed by destination path, and each value is the two-element array
 * `[percent, bytesPerSecond]` that the frontend destructures.
 */
type dlSnapshot struct {
	Current map[string][2]uint64 `json:"current"`
	Success int                  `json:"success"`
	Failed  int                  `json:"failed"`
}

// dlTransferProgress is the message shape of `plugin:upload|download`, whose
// payload is unrelated to the batch snapshot above.
type dlTransferProgress struct {
	Progress      uint64 `json:"progress"`
	ProgressTotal uint64 `json:"progressTotal"`
	Total         uint64 `json:"total"`
	TransferSpeed uint64 `json:"transferSpeed"`
}

/*
 * dlCancelEntry is the shared cancel flag of one cancel id.
 *
 * `batches` doubles as the reference count Rust kept: several batches may share
 * one id, and the entry only disappears once the last of them is done. It holds
 * one cancellation per batch rather than one per id so that a shared id can
 * abort every batch at once without a finishing batch tearing down the requests
 * of a sibling that is still running.
 */
type dlCancelEntry struct {
	cancelled atomic.Bool
	batches   map[uint64]context.CancelFunc
}

var (
	dlCancelMutex   sync.Mutex
	dlCancelEntries = map[string]*dlCancelEntry{}

	// dlBatchTokens hands out the keys of dlCancelEntry.batches.
	dlBatchTokens atomic.Uint64
)

// dlRegisterBatch is Rust's `CancelFlags::register`: it returns the flag shared
// by every batch using this id, together with the token that deregisters this
// particular batch.
func dlRegisterBatch(cancelID string, abort context.CancelFunc) (*dlCancelEntry, uint64) {
	token := dlBatchTokens.Add(1)

	dlCancelMutex.Lock()
	defer dlCancelMutex.Unlock()

	entry := dlCancelEntries[cancelID]

	if entry == nil {
		entry = &dlCancelEntry{batches: map[uint64]context.CancelFunc{}}
		dlCancelEntries[cancelID] = entry
	}

	entry.batches[token] = abort

	return entry, token
}

// dlDeregisterBatch is Rust's `CancelFlags::deregister`. Dropping the last
// batch of an id also drops its flag, so the next batch under the same id
// starts uncancelled.
func dlDeregisterBatch(cancelID string, token uint64) {
	dlCancelMutex.Lock()
	defer dlCancelMutex.Unlock()

	entry := dlCancelEntries[cancelID]

	if entry == nil {
		return
	}

	delete(entry.batches, token)

	if len(entry.batches) == 0 {
		delete(dlCancelEntries, cancelID)
	}
}

// dlFileProgress is the per-file bookkeeping behind one snapshot entry.
type dlFileProgress struct {
	downloaded     uint64
	total          uint64
	lastDownloaded uint64
}

// dlTracker is the progress map shared by the workers and the ticker.
type dlTracker struct {
	mutex sync.Mutex
	files map[string]*dlFileProgress
}

func dlNewTracker() *dlTracker {
	return &dlTracker{files: map[string]*dlFileProgress{}}
}

// start publishes a file as in flight. It is called once the response headers
// have landed, which is the first moment the total size is known.
func (t *dlTracker) start(path string, total uint64) {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	t.files[path] = &dlFileProgress{total: total}
}

func (t *dlTracker) advance(path string, count uint64) {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if file := t.files[path]; file != nil {
		file.downloaded += count
	}
}

// finish removes a file from the snapshot, whether it succeeded or not. The
// frontend deletes any path that stops appearing in `current`.
func (t *dlTracker) finish(path string) {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	delete(t.files, path)
}

/*
 * snapshot renders the files in flight and moves every speed window forward.
 *
 * The map is always allocated: the frontend runs `Object.entries` over it
 * unconditionally, and a nil map would reach it as `null`.
 */
func (t *dlTracker) snapshot() map[string][2]uint64 {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	current := make(map[string][2]uint64, len(t.files))

	for path, file := range t.files {
		// Ticks are 100ms apart, so the delta scaled by ten is roughly bytes/sec.
		speed := (file.downloaded - file.lastDownloaded) * dlSpeedFactor
		file.lastDownloaded = file.downloaded

		percent := uint64(0)

		if file.total > 0 {
			percent = min(file.downloaded*100/file.total, 100)
		}

		current[path] = [2]uint64{percent, speed}
	}

	return current
}

/*
 * dlBatch is the state one `concurrently_download` call shares between its
 * workers: the immutable entry list, the index they claim work from, the two
 * counters and the cancel flag of their id.
 */
type dlBatch struct {
	client       *http.Client
	entries      []DlEntry
	tracker      *dlTracker
	cancel       *dlCancelEntry
	batchContext context.Context
	label        string
	debug        bool
	next         atomic.Int64
	success      atomic.Int64
	failed       atomic.Int64
}

// ConcurrentlyDownload is the counterpart of `concurrently_download`.
func (d *DownloadService) ConcurrentlyDownload(
	entries []DlEntry,
	concurrency int,
	label string,
	cancelID string,
	streamID string,
	debug bool,
) (DlReport, error) {
	workerCount := max(concurrency, 1)

	/*
	 * Every request of this batch hangs off one context so that a cancellation
	 * unblocks reads that are waiting on the network. The flag is still what the
	 * workers consult, because the context alone cannot say whether a read
	 * failed because of a cancellation or because of a broken connection.
	 */
	batchContext, abortBatch := context.WithCancel(context.Background())
	defer abortBatch()

	cancel, token := dlRegisterBatch(cancelID, abortBatch)

	transport := dlNewTransport(workerCount)

	// Rust dropped its per-batch client here. A launcher session runs many
	// batches, so the pooled sockets are handed back rather than left idle.
	defer transport.CloseIdleConnections()

	batch := &dlBatch{
		client:       &http.Client{Transport: transport},
		entries:      entries,
		tracker:      dlNewTracker(),
		cancel:       cancel,
		batchContext: batchContext,
		label:        label,
		debug:        debug,
	}

	stopTicker := dlStartTicker(streamID, batch)

	// Each worker keeps its own failure list, so the only synchronisation the
	// hot path needs is the atomics above.
	collected := make([][]DlFailure, workerCount)

	var workers sync.WaitGroup

	for worker := range workerCount {
		workers.Add(1)

		go func() {
			defer workers.Done()

			collected[worker] = batch.runWorker()
		}()
	}

	workers.Wait()
	stopTicker()
	dlDeregisterBatch(cancelID, token)

	// The frontend iterates over `failures` unconditionally, so it is a list
	// even when nothing went wrong.
	failures := []DlFailure{}

	for _, workerFailures := range collected {
		failures = append(failures, workerFailures...)
	}

	report := DlReport{
		Success:   int(batch.success.Load()),
		Failed:    int(batch.failed.Load()),
		Cancelled: cancel.cancelled.Load(),
		Failures:  failures,
	}

	// The final snapshot clears every in-flight path and carries the counts the
	// report was built from.
	emitStream(streamID, dlSnapshot{
		Current: map[string][2]uint64{},
		Success: report.Success,
		Failed:  report.Failed,
	})

	/*
	 * This never rejects. Per-file problems belong to `failures`, and the one
	 * error Rust could return here was a reqwest client that failed to build,
	 * which has no equivalent in net/http.
	 */
	return report, nil
}

// CancelDownloads is the counterpart of `cancel_downloads`. It reports whether
// the id was registered at all, and never rejects.
func (d *DownloadService) CancelDownloads(cancelID string) bool {
	dlCancelMutex.Lock()

	entry := dlCancelEntries[cancelID]

	var aborts []context.CancelFunc

	if entry != nil {
		entry.cancelled.Store(true)
		aborts = make([]context.CancelFunc, 0, len(entry.batches))

		for _, abort := range entry.batches {
			aborts = append(aborts, abort)
		}
	}

	dlCancelMutex.Unlock()

	/*
	 * The requests are aborted outside the lock. Rust could rely on its 30 s
	 * read timeout to notice a cancellation on an idle connection; unblocking
	 * the reads instead makes a cancellation immediate, and a worker woken that
	 * way still classifies its own error by reading the flag.
	 */
	for _, abort := range aborts {
		abort()
	}

	return entry != nil
}

// DownloadFile is the counterpart of `plugin:upload|download`: a single file,
// its own headers, and a progress stream of its own shape.
func (d *DownloadService) DownloadFile(
	url string,
	filePath string,
	headers map[string]string,
	streamID string,
) error {
	transport := dlNewTransport(1)
	defer transport.CloseIdleConnections()

	client := &http.Client{Transport: transport}

	requestContext, abort := context.WithCancel(context.Background())
	defer abort()

	var stalled atomic.Bool

	watchdog := dlNewWatchdog(&stalled, abort)
	defer watchdog.Stop()

	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, url, nil)

	if err != nil {
		return fmt.Errorf("failed to download %s: %w", url, err)
	}

	dlApplyHeaders(request, headers)

	response, err := client.Do(request)

	if err != nil {
		return fmt.Errorf("failed to download %s: %w", url, dlCause(err, &stalled))
	}

	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf(
			"failed to download %s: the server responded with the '%s' status",
			url, response.Status,
		)
	}

	total := uint64(0)

	if response.ContentLength > 0 {
		total = uint64(response.ContentLength)
	}

	// The Tauri plugin let `File::create` fail on a missing parent. Creating it
	// matches the batch downloader and spares every caller the check.
	if parent := filepath.Dir(filePath); parent != "" {
		if err := os.MkdirAll(parent, dlDirectoryMode); err != nil {
			return fmt.Errorf("failed to download %s: %w", url, err)
		}
	}

	file, err := os.Create(filePath)

	if err != nil {
		return fmt.Errorf("failed to download %s: %w", url, err)
	}

	writer := bufio.NewWriterSize(file, dlChunkSize)
	reporter := &dlTransferReporter{streamID: streamID, total: total, emitted: time.Now()}

	streamErr := dlPump(response.Body, writer, watchdog, nil, reporter.add)

	if streamErr == nil {
		streamErr = writer.Flush()
	}

	// The handle is closed before the file is removed, since Windows refuses to
	// delete a file that is still open.
	closeErr := file.Close()

	if streamErr == nil {
		streamErr = closeErr
	}

	if streamErr != nil {
		// An incomplete file under its final name would be mistaken for a
		// finished download by everything that only checks existence.
		_ = os.Remove(filePath)

		return fmt.Errorf("failed to download %s: %w", url, dlCause(streamErr, &stalled))
	}

	// The last message always lands, so `progressTotal` ends up at the size
	// that was actually written even when the transfer was quick.
	reporter.report(true)

	return nil
}

/*
 * runWorker is one worker of the pool. It claims entries until the list runs
 * out, and stops early when its batch is cancelled — including in the middle of
 * a file, which is why a cancellation does not count as a failure.
 */
func (b *dlBatch) runWorker() []DlFailure {
	var failures []DlFailure

	for {
		if b.cancel.cancelled.Load() {
			return failures
		}

		index := int(b.next.Add(1) - 1)

		if index < 0 || index >= len(b.entries) {
			return failures
		}

		entry := b.entries[index]
		err := b.downloadOne(entry)

		b.tracker.finish(entry.Path)

		switch {
		case err == nil:
			b.success.Add(1)

			if b.debug {
				slog.Debug(b.label+": downloaded a file", "url", entry.URL)
			}
		case errors.Is(err, dlErrCancelled):
			if b.debug {
				slog.Debug(b.label+": cancelled a download", "url", entry.URL)
			}

			return failures
		default:
			b.failed.Add(1)

			slog.Error(b.label+": could not download a file", "url", entry.URL, "error", err)

			failures = append(failures, DlFailure{
				URL:   entry.URL,
				Path:  entry.Path,
				Error: err.Error(),
			})
		}
	}
}

// downloadOne fetches one entry into `<path>.part` and moves it into place.
func (b *dlBatch) downloadOne(entry DlEntry) error {
	/*
	 * The file gets a context of its own, derived from the batch, so that the
	 * stall watchdog can abort this one download without disturbing the others.
	 */
	requestContext, abort := context.WithCancel(b.batchContext)
	defer abort()

	var stalled atomic.Bool

	watchdog := dlNewWatchdog(&stalled, abort)
	defer watchdog.Stop()

	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, entry.URL, nil)

	if err != nil {
		return b.cause(err, &stalled)
	}

	// A batch entry carries no headers of its own; this is only here to keep the
	// identity of these requests the same as everywhere else.
	dlApplyHeaders(request, nil)

	response, err := b.client.Do(request)

	if err != nil {
		return b.cause(err, &stalled)
	}

	defer response.Body.Close()

	/*
	 * Rust called `error_for_status()` here. Redirects have already been
	 * followed at this point, so anything outside 2xx is a refusal — the same
	 * reading as the browser replica's `response.ok` check.
	 */
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("the server responded with the '%s' status", response.Status)
	}

	total := uint64(0)

	if response.ContentLength > 0 {
		total = uint64(response.ContentLength)
	}

	// From here on the path is visible in the progress snapshots, so the worker
	// has to take it out again once this returns.
	b.tracker.start(entry.Path, total)

	if parent := filepath.Dir(entry.Path); parent != "" {
		if err := os.MkdirAll(parent, dlDirectoryMode); err != nil {
			return b.cause(err, &stalled)
		}
	}

	partial := entry.Path + dlPartialSuffix
	file, err := os.Create(partial)

	if err != nil {
		return b.cause(err, &stalled)
	}

	writer := bufio.NewWriterSize(file, dlChunkSize)

	streamErr := dlPump(response.Body, writer, watchdog, b.interrupted, func(count uint64) {
		b.tracker.advance(entry.Path, count)
	})

	if streamErr == nil {
		streamErr = writer.Flush()
	}

	/*
	 * The handle is closed before the temporary file is removed or renamed:
	 * Windows refuses both while a file is open, and unlike Rust's `File` the
	 * handles Go opens are not shared for deletion.
	 */
	closeErr := file.Close()

	if streamErr != nil {
		_ = os.Remove(partial)

		return b.cause(streamErr, &stalled)
	}

	if closeErr != nil {
		_ = os.Remove(partial)

		return b.cause(closeErr, &stalled)
	}

	return b.cause(os.Rename(partial, entry.Path), &stalled)
}

// interrupted is the check the pump performs at every chunk boundary, which is
// where Rust consulted its cancel flag.
func (b *dlBatch) interrupted() error {
	if b.cancel.cancelled.Load() {
		return dlErrCancelled
	}

	return nil
}

/*
 * cause decides what a failed download reports.
 *
 * A cancelled batch aborts its contexts, so reads fail with a context error
 * that has to be read as a cancellation rather than as a broken download.
 * Cancellations therefore win over transport errors, which also keeps a batch
 * that is being torn down from filling the report with noise.
 */
func (b *dlBatch) cause(err error, stalled *atomic.Bool) error {
	if err == nil {
		return nil
	}

	if b.cancel.cancelled.Load() {
		return dlErrCancelled
	}

	return dlCause(err, stalled)
}

// dlCause names the one failure net/http reports as a plain context
// cancellation: a body that went quiet for longer than the read timeout.
func dlCause(err error, stalled *atomic.Bool) error {
	if err == nil {
		return nil
	}

	if stalled.Load() {
		return fmt.Errorf("the connection stalled for more than %s", dlReadTimeout)
	}

	return err
}

/*
 * dlStartTicker emits one snapshot per tick for the whole batch and returns the
 * function that stops it.
 *
 * That function waits for the goroutine to return so that no tick can land
 * after the final snapshot and revive a path the frontend has already dropped.
 * An empty stream id means the caller asked for no progress at all, in which
 * case the ticker is never started.
 */
func dlStartTicker(streamID string, batch *dlBatch) func() {
	if streamID == "" {
		return func() {}
	}

	done := make(chan struct{})
	stopped := make(chan struct{})

	go func() {
		defer close(stopped)

		// A Go ticker drops the ticks a busy receiver missed, which is the
		// `MissedTickBehavior::Skip` the Rust interval was set to.
		ticker := time.NewTicker(dlTickInterval)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				emitStream(streamID, dlSnapshot{
					Current: batch.tracker.snapshot(),
					Success: int(batch.success.Load()),
					Failed:  int(batch.failed.Load()),
				})
			}
		}
	}()

	return func() {
		close(done)
		<-stopped
	}
}

/*
 * dlPump copies a response body into writer in dlChunkSize reads.
 *
 * `beforeWrite` may abort at a chunk boundary, which is where Rust checked its
 * cancel flag, and `afterWrite` accounts for the bytes that landed. Either hook
 * may be nil when a caller has nothing to do there.
 */
func dlPump(
	body io.Reader,
	writer io.Writer,
	watchdog *time.Timer,
	beforeWrite func() error,
	afterWrite func(count uint64),
) error {
	buffer := make([]byte, dlChunkSize)

	for {
		read, readErr := body.Read(buffer)

		if read > 0 {
			// Bytes arrived, so the stall watchdog starts over.
			watchdog.Reset(dlReadTimeout)

			if beforeWrite != nil {
				if err := beforeWrite(); err != nil {
					return err
				}
			}

			if _, err := writer.Write(buffer[:read]); err != nil {
				return err
			}

			if afterWrite != nil {
				afterWrite(uint64(read))
			}
		}

		if readErr == io.EOF {
			return nil
		}

		if readErr != nil {
			return readErr
		}
	}
}

// dlNewWatchdog arms the read timeout. Firing it records why the request was
// aborted, so the failure can be reported as a stall instead of as the context
// cancellation net/http surfaces.
func dlNewWatchdog(stalled *atomic.Bool, abort context.CancelFunc) *time.Timer {
	return time.AfterFunc(dlReadTimeout, func() {
		stalled.Store(true)
		abort()
	})
}

/*
 * dlNewTransport builds the per-batch equivalent of the reqwest client.
 *
 * Go pools only two idle connections per host by default, so every worker past
 * the second would reconnect for each file it claims; the launcher fetches
 * thousands of small objects from a handful of hosts, so the pool is sized
 * after the worker count instead.
 */
func dlNewTransport(connections int) *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   dlConnectTimeout,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:   true,
		MaxIdleConns:        connections * 2,
		MaxIdleConnsPerHost: connections,
		IdleConnTimeout:     90 * time.Second,
		// reqwest's connect timeout covers the TLS handshake as well.
		TLSHandshakeTimeout:   dlConnectTimeout,
		ExpectContinueTimeout: time.Second,
	}
}

/*
 * dlApplyHeaders installs the caller's headers and suppresses the identity Go
 * would otherwise invent.
 *
 * reqwest sends no `User-Agent` unless one is configured, and nothing in this
 * launcher ever configured one, so the hosts it talks to have only ever seen
 * requests without that header. Announcing "Go-http-client" instead would be a
 * new identity in front of every CDN the launcher depends on.
 */
func dlApplyHeaders(request *http.Request, headers map[string]string) {
	request.Header["User-Agent"] = nil

	for name, value := range headers {
		// Go keeps the host out of the header map, and a caller overriding it
		// means the request itself, not a header of it.
		if http.CanonicalHeaderKey(name) == "Host" {
			request.Host = value

			continue
		}

		request.Header.Set(name, value)
	}
}

/*
 * dlTransferReporter turns a byte stream into `plugin:upload|download`
 * messages.
 *
 * The Rust plugin sent one message per chunk. Reporting is throttled to the
 * snapshot cadence of the batch downloader instead, because a large file would
 * otherwise push tens of thousands of events across the bridge for a progress
 * bar that repaints sixty times a second. `progress` stays an increment, so it
 * still sums to `progressTotal`; it just covers everything since the previous
 * message.
 */
type dlTransferReporter struct {
	streamID string
	total    uint64
	written  uint64
	pending  uint64
	emitted  time.Time
}

func (r *dlTransferReporter) add(count uint64) {
	r.written += count
	r.pending += count

	r.report(false)
}

func (r *dlTransferReporter) report(force bool) {
	elapsed := time.Since(r.emitted)

	if !force && elapsed < dlTickInterval {
		return
	}

	speed := uint64(0)

	if elapsed > 0 {
		speed = uint64(float64(r.pending) / elapsed.Seconds())
	}

	emitStream(r.streamID, dlTransferProgress{
		Progress:      r.pending,
		ProgressTotal: r.written,
		Total:         r.total,
		TransferSpeed: speed,
	})

	r.pending = 0
	r.emitted = time.Now()
}

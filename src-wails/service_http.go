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
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

/*
 * HTTPService is the counterpart of `@tauri-apps/plugin-http`.
 *
 * The frontend never calls this service directly: it calls the plugin's
 * `fetch()`, which drives a four-stage pipeline over IPC. Each stage keeps its
 * plugin name so the bridge stays readable next to the browser replica:
 *
 *  1. `Fetch`         (`plugin:http|fetch`)         registers a request, returns its id
 *  2. `FetchSend`     (`plugin:http|fetch_send`)    performs it, returns the response metadata
 *  3. `FetchReadBody` (`plugin:http|fetch_read_body`) returns the body and forgets the request
 *  4. `FetchCancel`   (`plugin:http|fetch_cancel`)  aborts it and forgets it
 *
 * The plugin pulled the body one chunk at a time, each answer carrying a
 * trailing flag byte, so that the JS side could expose a `ReadableStream`. That
 * loop exists to move bytes over an IPC that cannot stream; this port returns
 * the whole body in one base64 answer instead, and the bridge hands it to
 * `Response` as a single chunk. Every caller in this launcher awaits `json()`,
 * `text()` or `blob()`, so nothing observes the difference.
 */
type HTTPService struct{}

/*
 * htpRequestTimeouts only bound the phases that would otherwise hang forever.
 *
 * The plugin sets no total timeout, and neither does this: a slow Modrinth
 * search is not an error, and the frontend cancels what it no longer wants.
 */
const (
	htpConnectTimeout = 30 * time.Second
	htpIdleTimeout    = 90 * time.Second

	// htpIdleConnections is how many sockets per host the pool keeps warm.
	htpIdleConnections = 8
)

// HTTPFetchResponse is the metadata of a sent request: the plugin's
// `FetchResponse`, minus the body, which is read separately.
type HTTPFetchResponse struct {
	Status     int         `json:"status"`
	StatusText string      `json:"statusText"`
	Headers    [][2]string `json:"headers"`
	URL        string      `json:"url"`
	RequestID  int64       `json:"rid"`
}

/*
 * htpRequest is one registered request.
 *
 * Header pairs are kept as an ordered list rather than a map because that is
 * what a `Headers` object turns into on the JS side, and because a request may
 * legitimately repeat a name.
 */
type htpRequest struct {
	method   string
	url      string
	headers  [][2]string
	body     []byte
	abort    context.CancelFunc
	response *http.Response
}

var (
	htpMutex    sync.Mutex
	htpRequests = map[int64]*htpRequest{}

	// htpRequestIDs mints the plugin's resource ids. They only have to be
	// unique for the lifetime of the process.
	htpRequestIDs atomic.Int64

	/*
	 * htpClient is shared by every request. The plugin built one reqwest client
	 * per plugin instance, and one client here means the handful of hosts this
	 * launcher talks to (Microsoft, Mojang, Modrinth) keep their connections
	 * warm across the many small calls the UI makes.
	 */
	htpClient = sync.OnceValue(func() *http.Client {
		return &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   htpConnectTimeout,
					KeepAlive: 30 * time.Second,
				}).DialContext,
				ForceAttemptHTTP2: true,
				// The pool outlives every individual call, so a burst of
				// parallel requests to one API does not close and reopen
				// connections behind Go's default of two idle ones per host.
				MaxIdleConns:          htpIdleConnections * 2,
				MaxIdleConnsPerHost:   htpIdleConnections,
				IdleConnTimeout:       htpIdleTimeout,
				TLSHandshakeTimeout:   htpConnectTimeout,
				ExpectContinueTimeout: time.Second,
			},
		}
	})
)

/*
 * Fetch registers a request and returns its id.
 *
 * `headers` is a list of `[name, value]` pairs, and `body` is the request body
 * as base64 — empty for the bodyless requests the plugin described with a null
 * `data` field. The URL is validated here so that a malformed one rejects from
 * this stage, exactly as it did in Rust.
 */
func (h *HTTPService) Fetch(method string, requestURL string, headers [][2]string, body string) (int64, error) {
	parsed, err := url.Parse(requestURL)

	if err != nil {
		return 0, fmt.Errorf("the '%s' URL could not be parsed: %w", requestURL, err)
	}

	if parsed.Scheme == "" || parsed.Host == "" {
		return 0, fmt.Errorf("the '%s' URL is not absolute", requestURL)
	}

	var payload []byte

	if body != "" {
		payload, err = decodeBytes(body)

		if err != nil {
			return 0, fmt.Errorf("the request body could not be decoded: %w", err)
		}
	}

	if method == "" {
		method = http.MethodGet
	}

	requestID := htpRequestIDs.Add(1)

	htpMutex.Lock()
	defer htpMutex.Unlock()

	htpRequests[requestID] = &htpRequest{
		method:  strings.ToUpper(method),
		url:     requestURL,
		headers: headers,
		body:    payload,
	}

	return requestID, nil
}

// FetchSend performs a registered request and returns everything about the
// response except its body.
func (h *HTTPService) FetchSend(requestID int64) (HTTPFetchResponse, error) {
	htpMutex.Lock()
	pending := htpRequests[requestID]
	alreadySent := pending != nil && pending.response != nil
	htpMutex.Unlock()

	if pending == nil {
		return HTTPFetchResponse{}, htpUnknownRequest(requestID)
	}

	if alreadySent {
		// Sending twice would strand the first response's connection, and there
		// is no answer to give for it. The plugin's own client never does this.
		return HTTPFetchResponse{}, fmt.Errorf("the request with the '%d' identifier was already sent", requestID)
	}

	requestContext, abort := context.WithCancel(context.Background())

	var body io.Reader

	// A nil reader is what makes net/http send no body at all; a zero-length
	// one would still announce `Content-Length: 0`.
	if pending.body != nil {
		body = bytes.NewReader(pending.body)
	}

	request, err := http.NewRequestWithContext(requestContext, pending.method, pending.url, body)

	if err != nil {
		abort()
		htpDrop(requestID)

		return HTTPFetchResponse{}, err
	}

	htpApplyHeaders(request, pending.headers)

	/*
	 * The cancellation is published before the request goes out, so that
	 * FetchCancel can abort a request that is still in flight. The lock is not
	 * held across the call itself: that would serialise every request and block
	 * the very cancellation this pipeline exists to support.
	 */
	htpMutex.Lock()
	pending.abort = abort
	stillPending := htpRequests[requestID] == pending
	htpMutex.Unlock()

	if !stillPending {
		abort()

		return HTTPFetchResponse{}, htpCancelledRequest(requestID)
	}

	response, err := htpClient().Do(request)

	if err != nil {
		abort()
		htpDrop(requestID)

		return HTTPFetchResponse{}, err
	}

	htpMutex.Lock()
	stillPending = htpRequests[requestID] == pending

	if stillPending {
		pending.response = response
	}

	htpMutex.Unlock()

	if !stillPending {
		// Cancelled while the response was on its way, so nobody will ever read
		// this body and the connection would leak.
		_ = response.Body.Close()
		abort()

		return HTTPFetchResponse{}, htpCancelledRequest(requestID)
	}

	return HTTPFetchResponse{
		Status:     response.StatusCode,
		StatusText: htpStatusText(response),
		Headers:    htpCollectHeaders(response.Header),
		URL:        htpFinalURL(response, pending.url),
		RequestID:  requestID,
	}, nil
}

/*
 * FetchReadBody returns the response body as base64 and forgets the request.
 *
 * The entry is dropped whether the read succeeds or not: a body is read exactly
 * once, and nothing else in the pipeline touches the request afterwards.
 */
func (h *HTTPService) FetchReadBody(requestID int64) (string, error) {
	htpMutex.Lock()
	pending := htpRequests[requestID]

	var response *http.Response

	if pending != nil {
		response = pending.response
	}

	htpMutex.Unlock()

	if pending == nil {
		return "", htpUnknownRequest(requestID)
	}

	defer htpDrop(requestID)

	if response == nil {
		return "", fmt.Errorf("the request with the '%d' identifier has not been sent", requestID)
	}

	// Read outside the lock, so that a cancellation arriving mid-body can close
	// this body and unblock the read.
	contents, err := io.ReadAll(response.Body)

	if err != nil {
		return "", err
	}

	return encodeBytes(contents), nil
}

/*
 * FetchCancel aborts a request and forgets it, reporting whether it was still
 * registered.
 *
 * It backs both `plugin:http|fetch_cancel` and `plugin:http|fetch_cancel_body`:
 * the plugin distinguished aborting a request from releasing its body stream,
 * and with the body read in one call there is nothing left to release
 * separately.
 */
func (h *HTTPService) FetchCancel(requestID int64) bool {
	return htpDrop(requestID)
}

/*
 * htpDrop forgets a request, closing whatever it still holds.
 *
 * This is the only place entries leave the registry, so a request cannot
 * outlive the pipeline: an unread body is closed and the context is cancelled,
 * which returns the connection to the pool instead of stranding it.
 */
func htpDrop(requestID int64) bool {
	htpMutex.Lock()

	pending := htpRequests[requestID]
	delete(htpRequests, requestID)

	var (
		response *http.Response
		abort    context.CancelFunc
	)

	if pending != nil {
		response, abort = pending.response, pending.abort
	}

	htpMutex.Unlock()

	/*
	 * Both calls happen outside the lock. Closing a body is what unblocks a
	 * reader that is waiting on it, and that reader must never have to wait for
	 * this mutex to make progress.
	 */
	if response != nil {
		_ = response.Body.Close()
	}

	if abort != nil {
		abort()
	}

	return pending != nil
}

// htpUnknownRequest words its message like the browser replica, which is what
// the frontend's error paths were written against.
func htpUnknownRequest(requestID int64) error {
	return fmt.Errorf("there is no pending request with the '%d' identifier", requestID)
}

func htpCancelledRequest(requestID int64) error {
	return fmt.Errorf("the request with the '%d' identifier was cancelled", requestID)
}

/*
 * htpApplyHeaders installs the caller's header pairs in order.
 *
 * `Add` rather than `Set`, because a repeated name is meaningful and the pairs
 * arrive from a `Headers` object that already flattened what it wanted to
 * combine. The empty `User-Agent` matches the reqwest client the plugin built,
 * which sent none; the auth flow relies on the same freedom to send an empty
 * `Origin`, so no header is filtered here.
 */
func htpApplyHeaders(request *http.Request, headers [][2]string) {
	request.Header["User-Agent"] = nil

	for _, header := range headers {
		name, value := header[0], header[1]

		if name == "" {
			continue
		}

		// Go keeps the host out of the header map: overriding it means the
		// request itself, not one of its headers.
		if http.CanonicalHeaderKey(name) == "Host" {
			request.Host = value

			continue
		}

		request.Header.Add(name, value)
	}
}

/*
 * htpCollectHeaders flattens the response headers into the pair list the plugin
 * returned, so that the bridge can feed them straight into `new Headers(...)`.
 *
 * Names are sorted because Go stores them in a map and the iteration order
 * would otherwise change from call to call. The order of the values under one
 * name is preserved, which is what multi-value headers such as `Set-Cookie`
 * depend on.
 */
func htpCollectHeaders(header http.Header) [][2]string {
	pairs := make([][2]string, 0, len(header))

	for name, values := range header {
		for _, value := range values {
			pairs = append(pairs, [2]string{name, value})
		}
	}

	sort.SliceStable(pairs, func(first int, second int) bool {
		return pairs[first][0] < pairs[second][0]
	})

	return pairs
}

// htpStatusText isolates the reason phrase, since `Status` reads "404 Not
// Found" while the plugin reported only "Not Found". A server may invent a
// phrase Go does not know, so what it actually sent wins.
func htpStatusText(response *http.Response) string {
	prefix := strconv.Itoa(response.StatusCode) + " "

	if strings.HasPrefix(response.Status, prefix) {
		return strings.TrimPrefix(response.Status, prefix)
	}

	return http.StatusText(response.StatusCode)
}

// htpFinalURL reports where the response came from, which is the end of the
// redirect chain rather than the URL that was registered.
func htpFinalURL(response *http.Response, fallback string) string {
	if response.Request != nil && response.Request.URL != nil {
		return response.Request.URL.String()
	}

	return fallback
}

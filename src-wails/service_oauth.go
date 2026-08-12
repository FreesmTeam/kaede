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
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

/*
 * The counterpart of '@fabianlars/tauri-plugin-oauth'.
 *
 * Microsoft's authorization code flow redirects a system browser back to
 * 'http://localhost:<port>', so signing in needs a real loopback server for
 * the length of the flow. This is the one capability the browser preview can
 * never have, and the reason its 'plugin:oauth|start' simply rejects.
 *
 * The frontend drives it through three touch points: 'start' returns the port
 * it picked, the redirect arrives as an 'oauth://url' event carrying the full
 * request URL, and 'cancel' tears the server down.
 */

// oauthRedirectEvent is the event name the plugin's 'onUrl' helper listens on.
const oauthRedirectEvent = "oauth://url"

// oauthInvalidEvent carries requests that reached the server without a query.
const oauthInvalidEvent = "oauth://invalid-url"

/*
 * oauthShutdownGrace bounds how long a cancelled server waits for the
 * browser to finish collecting the response page before the listener closes.
 */
const oauthShutdownGrace = 2 * time.Second

type oauthServer struct {
	server *http.Server
}

var (
	oauthMutex   sync.Mutex
	oauthServers = map[int]*oauthServer{}
)

// OAuthService owns the short-lived loopback servers used for signing in.
type OAuthService struct{}

/*
 * Start listens on a free loopback port and reports it.
 *
 * The first request that carries a query string is taken as the redirect: its
 * URL is forwarded to the frontend, which validates the state and extracts
 * the authorization code. Browsers also ask for '/favicon.ico', so requests
 * without a query are answered but not treated as the redirect.
 */
func (o *OAuthService) Start(response string) (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")

	if err != nil {
		return 0, fmt.Errorf("failed to start the OAuth2 redirect server: %w", err)
	}

	address, ok := listener.Addr().(*net.TCPAddr)

	if !ok {
		listener.Close()

		return 0, fmt.Errorf("failed to read the port of the OAuth2 redirect server")
	}

	port := address.Port
	page := response

	if page == "" {
		page = "<html><body>You can close this tab now.</body></html>"
	}

	server := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			writer.WriteHeader(http.StatusOK)
			_, _ = writer.Write([]byte(page))

			// The scheme and host are ours; the frontend only parses the query.
			full := "http://localhost:" + fmt.Sprint(port) + request.RequestURI

			if request.URL.RawQuery == "" {
				emitTauriEvent(oauthInvalidEvent, full)

				return
			}

			emitTauriEvent(oauthRedirectEvent, full)
		}),
	}

	oauthMutex.Lock()
	oauthServers[port] = &oauthServer{server: server}
	oauthMutex.Unlock()

	go func() {
		// Serve returns as soon as Cancel closes the listener.
		_ = server.Serve(listener)
	}()

	return port, nil
}

// Cancel stops the redirect server that Start opened on the given port.
func (o *OAuthService) Cancel(port int) error {
	oauthMutex.Lock()
	running, found := oauthServers[port]
	delete(oauthServers, port)
	oauthMutex.Unlock()

	if !found {
		return fmt.Errorf("there is no OAuth2 redirect server on the port %d", port)
	}

	ctx, release := context.WithTimeout(context.Background(), oauthShutdownGrace)
	defer release()

	if err := running.server.Shutdown(ctx); err != nil {
		// A stubborn connection must not keep the port bound.
		_ = running.server.Close()
	}

	return nil
}

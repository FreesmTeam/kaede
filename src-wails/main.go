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

// Command kaede is the Wails v3 backend of the Kaede launcher.
//
// It replaces the Tauri (Rust) backend: every service method exposed here is
// the Go counterpart of a `#[tauri::command]` or of a Tauri plugin endpoint.
// The frontend never calls these methods directly. Instead, `src/lib/__wails`
// installs a `window.__TAURI_INTERNALS__` shim that translates Tauri IPC
// command names into `Call.ByName("main.<Service>.<Method>", ...)`.
package main

import (
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// The compiled frontend. The directory is populated by `task build:frontend`
// (which copies the Vite output of the repository root into it), so the
// `.gitkeep` file is what keeps this embed directive valid on a clean tree.
//
//go:embed all:frontend
var frontendAssets embed.FS

// devServerURL is used when no compiled frontend has been embedded. It lets
// `bun dev:frontend` drive the UI while the Go backend runs from source.
const devServerURL = "http://localhost:5173"

// windowLabel mirrors the Tauri window label. The frontend addresses the
// window as "main" through `getCurrentWebviewWindow()`.
const windowLabel = "main"

func main() {
	app := application.New(application.Options{
		Name:        "Kaede",
		Description: "A Minecraft Launcher",
		LogLevel:    slog.LevelWarn,
		Services:    services(),
		Assets: application.AssetOptions{
			Handler: frontendHandler(),
		},
	})

	// Every service needs the application handle to emit events, and the
	// launcher needs the window to implement `plugin:window|show`.
	setApplication(app)

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:            windowLabel,
		Title:           "Kaede",
		Width:           800,
		Height:          600,
		MinWidth:        512,
		MinHeight:       288,
		InitialPosition: application.WindowCentered,
		// The Tauri config starts the window hidden; the frontend calls
		// `show()` once initialization (and optionally extension loading)
		// has finished. `plugin:window|show` is wired to the same window.
		Hidden:          true,
		DevToolsEnabled: true,
		BackgroundColour: application.RGBA{
			Red: 0, Green: 0, Blue: 0, Alpha: 255,
		},
	})

	if err := app.Run(); err != nil {
		slog.Error("kaede: the application stopped", "error", err)
		os.Exit(1)
	}
}

// services lists every Go service exposed to the frontend. The bridge in
// `src/lib/__wails/scopes/call-service.ts` refers to these by the fully
// qualified name that Wails derives from `reflect`: because the types live in
// package `main`, the names are `main.<Type>.<Method>`.
func services() []application.Service {
	return []application.Service{
		application.NewService(&ArchiveService{}),
		application.NewService(&DownloadService{}),
		application.NewService(newEnvironmentService()),
		application.NewService(&FilesystemService{}),
		application.NewService(&FinalizationService{}),
		application.NewService(&HashService{}),
		application.NewService(&HTTPService{}),
		application.NewService(newLauncherService()),
		application.NewService(newLoggingService()),
		application.NewService(&OAuthService{}),
		application.NewService(newProcessService()),
		application.NewService(&ShellService{}),
		application.NewService(newSystemService()),
		application.NewService(&TranslationsService{}),
	}
}

// assetRoute backs the frontend's `convertFileSrc`. Tauri hands the webview an
// `asset://` URL for a path on disk; the closest equivalent here is a route on
// the application's own asset server.
const assetRoute = "/kaede-file/"

// frontendHandler serves the embedded Vite build plus the local-file route.
//
// Note that `/wails/runtime.js` is served by an application-level middleware
// that runs before this handler, so the runtime stays reachable in both modes.
func frontendHandler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc(assetRoute, serveLocalFile)
	mux.Handle("/", frontendAssetHandler())

	return mux
}

// serveLocalFile answers the `convertFileSrc` route. Instance icons and skins
// live outside the bundle, so the webview has to be able to read them from
// disk. The Tauri build granted the asset protocol the same unrestricted
// scope, and the listener is bound to loopback only.
func serveLocalFile(writer http.ResponseWriter, request *http.Request) {
	path := request.URL.Query().Get("path")

	if path == "" {
		http.Error(writer, "the 'path' parameter is missing", http.StatusBadRequest)

		return
	}

	http.ServeFile(writer, request, filepath.Clean(path))
}

// frontendAssetHandler serves the embedded Vite build. When the build has not
// been copied in yet (a source checkout), requests are proxied to the Vite dev
// server instead so that `go run .` still shows a working UI.
func frontendAssetHandler() http.Handler {
	dist, err := fs.Sub(frontendAssets, "frontend/dist")

	if err == nil {
		if _, statErr := fs.Stat(dist, "index.html"); statErr == nil {
			return application.BundledAssetFileServer(dist)
		}
	}

	target, err := url.Parse(devServerURL)

	if err != nil {
		slog.Error("kaede: the development server URL is invalid", "error", err)
		os.Exit(1)
	}

	slog.Warn("kaede: no embedded frontend found, proxying to the development server", "url", devServerURL)

	return httputil.NewSingleHostReverseProxy(target)
}

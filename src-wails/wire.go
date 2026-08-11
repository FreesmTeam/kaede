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
	"encoding/base64"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

/*
 * Shared plumbing for every service in this package.
 *
 * Services must not redefine anything declared here. Binary payloads always
 * cross the bridge as standard base64 strings, because Wails marshals []byte
 * to a base64 JSON string and the TypeScript side re-materialises the
 * Uint8Array that the Tauri API contract requires.
 */

var (
	applicationMutex  sync.RWMutex
	applicationHandle *application.App
)

// setApplication records the running application so that services can emit
// events without each of them holding its own reference.
func setApplication(app *application.App) {
	applicationMutex.Lock()
	defer applicationMutex.Unlock()

	applicationHandle = app
}

// currentApplication returns the running application, or nil before startup.
func currentApplication() *application.App {
	applicationMutex.RLock()
	defer applicationMutex.RUnlock()

	return applicationHandle
}

/*
 * The streamEventPrefix namespaces every per-call push stream.
 *
 * Tauri models progress reporting with `Channel`, an object the frontend
 * passes straight into `invoke`. Wails has no equivalent, so the bridge mints
 * an identifier per channel, hands it to Go as a plain string, and listens for
 * `kaede:stream:<id>`. Anything emitted here reaches that one channel only.
 */
const streamEventPrefix = "kaede:stream:"

// emitStream pushes one message to the frontend Channel identified by
// streamID. An empty identifier makes this a no-op, which lets callers treat
// progress reporting as optional.
func emitStream(streamID string, payload any) {
	if streamID == "" {
		return
	}

	app := currentApplication()

	if app == nil {
		return
	}

	app.Event.Emit(streamEventPrefix+streamID, payload)
}

// emitTauriEvent forwards a backend event under the very name the Rust backend
// used (for example "process-output"). The bridge re-dispatches it to the
// listeners registered through `plugin:event|listen`.
func emitTauriEvent(name string, payload any) {
	app := currentApplication()

	if app == nil {
		return
	}

	app.Event.Emit(name, payload)
}

// encodeBytes renders a binary payload for the bridge.
func encodeBytes(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// decodeBytes parses a binary payload produced by the bridge.
func decodeBytes(encoded string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(encoded)
}

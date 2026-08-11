[<<< Back](../README.md)

# Wails backend

The Go backend of Kaede, built on [Wails v3](https://v3.wails.io/). It is an alternative to `src-tauri/`: the same launcher frontend, the same behaviour, a different host process.

Nothing in `src/` is aware of it except [`src/lib/__wails/`](../src/lib/__wails), which translates Tauri IPC calls into calls on the services declared here, and one block in [`src/main.ts`](../src/main.ts) that installs the bridge. Read [`src/lib/__wails/README.md`](../src/lib/__wails/README.md) first if you want the frontend half of the story.

## Layout

| File | Contents |
|------|----------|
| `main.go` | Application bootstrap, the window, the service registry, the asset routes |
| `wire.go` | Shared plumbing: the application handle, event and stream emission, base64 helpers |
| `native.go` | Thin wrappers over the Wails native surface (dialogs, clipboard, browser, window) |
| `service_*.go` | One file per domain, each the Go counterpart of a Rust module in `src-tauri/src/` |

`main.go`, `wire.go` and `native.go` are the only files that touch `pkg/application`. Every service is plain Go, which keeps them portable and testable.

Services live in package `main`, so Wails exposes them as `main.<Type>.<Method>` — the names the bridge calls by.

## Building

The backend serves the frontend, so the frontend is built first and copied into `frontend/dist`, where `//go:embed` can reach it.

```sh
# from the repository root
bun install
bun run build:frontend

mkdir -p src-wails/frontend/dist
cp -r dist/. src-wails/frontend/dist/

cd src-wails
go build -o kaede .
```

`wails3 task build` does the same through `Taskfile.yml` if you have the [CLI](https://v3.wails.io/getting-started/installation/):

```sh
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.6
```

### Platform requirements

Wails links against the system webview, so a native build needs its development headers:

| Platform | Requirement |
|----------|-------------|
| Linux | `libgtk-3-dev` and `libwebkit2gtk-4.1-dev`, and `CGO_ENABLED=1` |
| macOS | The Xcode command line tools, and `CGO_ENABLED=1` |
| Windows | Nothing extra — WebView2 is loaded at runtime and the build is pure Go |

A quick compile check that needs no system libraries at all:

```sh
GOOS=windows CGO_ENABLED=0 go build ./...
```

## Developing

With no `frontend/dist` embedded, the backend proxies to the Vite dev server instead, so the usual frontend loop still works:

```sh
bun run dev:frontend   # terminal one, serves http://localhost:5173
cd src-wails && go run .   # terminal two
```

## Adding a command

1. Add the method to the relevant `service_*.go` (or add a new service and register it in `services()` in `main.go`).
2. Add the matching `case` to `src/lib/__wails/scopes/wails-invoke.ts`.

Anything binary crosses the bridge as base64: Wails marshals `[]byte` to a base64 string, and the bridge turns it back into the `Uint8Array` the Tauri API contract promises. Progress reporting goes through `emitStream`, and events that the Rust backend emitted by name go through `emitTauriEvent`.

[<<< Back](../README.md)

# Wails

Kaede is a Webview-based application that requires a [Tauri](https://v2.tauri.app/) environment. The `__browser/` directory replaces that environment with browser built-ins so the UI can be previewed without installing anything. This directory does the opposite: it keeps a **real** desktop backend, but a different one. Every Tauri IPC call is translated into a call on a Go service running under [Wails v3](https://v3.wails.io/), which lives in [`src-wails/`](../../../src-wails).

Nothing outside this directory and [`src/main.ts`](../../main.ts) is aware that the backend changed. The frontend keeps importing `@tauri-apps/*` exactly as before.

## How it attaches

`main.ts` probes for the backend before anything else decides where it is running:

```ts
if (await Wails.detectIsWails()) {
  await Wails.handleTauriEnvironment();
}

if (Browser.detectIsBrowser()) {
  await Browser.handleTauriEnvironment();
}
```

`handleTauriEnvironment` installs `window.__TAURI_INTERNALS__` (whose `invoke` is this bridge), `window.__TAURI_OS_PLUGIN_INTERNALS__`, and `window.__TAURI__` — the last one being what `detectIsBrowser` looks for, so at most one of the two branches ever runs.

### Detection

A Wails webview injects nothing into the page, so there is no global to test synchronously. Instead the probe tries to import `/wails/runtime.js`, which a Wails v3 application serves from an application-level middleware. Outside of Wails that request answers with the index page or a 404, neither of which parses as a module.

This is also why there is **no `@wailsio/runtime` dependency**: the runtime is taken from the backend that is hosting the page, so it can never drift out of step with the Go binary, and `package.json` is left untouched.

### Calling Go

Wails addresses a bound method by a fully qualified name built from the package path of the receiver. Every service is declared in the `main` package of `src-wails`, so [`call-service.ts`](scopes/call-service.ts) simply prefixes `main.`:

```ts
callService("HashService.Sha256", contents);   // -> main.HashService.Sha256
```

Rejections are flattened back to plain strings, because Tauri commands reject with a bare string and the application interpolates rejections straight into log lines.

## Things Tauri has and Wails does not

| Tauri concept | How it is bridged |
|---------------|-------------------|
| `Channel` (`onProgress`, `onEvent`) | Each channel is given an id which travels to Go as a plain string. The backend emits `kaede:stream:<id>`, and [`handle-channels.ts`](scopes/handle-channels.ts) forwards every message into the channel until the owning call settles |
| `AppHandle#emit` (`process-output`, …) | Go emits under the original event name. The first `plugin:event|listen` for a name subscribes to the matching Wails event and fans it out through the same callback registry the browser replica uses |
| Raw `Uint8Array` IPC bodies | Wails marshals `[]byte` to base64, so binary crosses the bridge encoded and is re-materialised into the exact shape the Tauri API promises |
| `convertFileSrc` / the asset protocol | The backend serves `/kaede-file/?path=…`, so local icons are streamed instead of being held in memory as data URLs |
| A raw-body command (`hash_sha256`, `hash_md5`) | The payload *is* the array, so the bridge encodes it before the call rather than reading a named argument |

## Mockups

Unlike the browser replicas, these are not placeholders: each one is backed by a real implementation in Go, so the launcher actually downloads, unpacks, hashes, spawns Java and signs in.

<details>

| `@tauri-apps/api`                 | Bridged                                          |
|-----------------------------------|--------------------------------------------------|
| `invoke()`                        | Yes (see the tables below)                       |
| `transformCallback()`             | Yes (a module-level callback registry)           |
| `convertFileSrc()`                | Yes (a backend route that streams the file)      |
| `event.listen()` / `event.emit()` | Yes (bridged to the Wails event bus)             |
| `Channel`                         | Yes (bridged to a per-call Wails event stream)   |

---

| `@tauri-apps/plugin-fs` | Go service |
|-------------------------|------------|
| `exists()`, `mkdir()`, `readDir()`, `readFile()`, `readTextFile()`, `remove()`, `rename()`, `size()`, `stat()`, `lstat()`, `writeFile()`, `writeTextFile()` | `FilesystemService` (the real file system) |

---

| Package                                | Go service                                                        |
|----------------------------------------|-------------------------------------------------------------------|
| `@tauri-apps/plugin-http`              | `HTTPService` (the plugin's pull-body protocol, no CORS limits)   |
| `@tauri-apps/plugin-dialog`            | `ShellService` (native dialogs and the native file picker)        |
| `@tauri-apps/plugin-upload`            | `DownloadService.DownloadFile` (`download()` only)                |
| `@tauri-apps/plugin-opener`            | `ShellService` (`openUrl()`, `revealItemInDir()`)                 |
| `@tauri-apps/plugin-clipboard-manager` | `ShellService` (`writeText()` only)                               |
| `@tauri-apps/plugin-os`                | `EnvironmentService` (the real platform)                          |
| `@tauri-apps/plugin-log`               | `LoggingService` (the launcher log file)                          |
| `tauri-plugin-shellx`                  | `ShellService.Execute`                                            |
| `@fabianlars/tauri-plugin-oauth`       | `OAuthService` — a real loopback redirect server, so Microsoft sign-in works |

---

The custom (`src-tauri/`) commands:

| Command                                                            | Go service                              |
|--------------------------------------------------------------------|------------------------------------------|
| `get_initial_state`                                                | `LauncherService.GetInitialState`        |
| `finalize_initialization`                                          | `FinalizationService`                    |
| `get_java_major`, `detect_java_installations`                      | `FinalizationService`                    |
| `verify_file_paths`, `get_missing_files`                           | `LauncherService`                        |
| `hash_sha256`, `hash_md5`, `hash_sha1_file`                        | `HashService`                            |
| `concurrently_download`, `cancel_downloads`                        | `DownloadService`                        |
| `read_archive_entry`, `unzip_files`                                | `ArchiveService`                         |
| `peek_mrpack`, `install_mrpack`                                    | `ArchiveService`                         |
| `read_extensions`                                                  | `ArchiveService.ReadExtensions`          |
| `get_locales`                                                      | `TranslationsService.GetLocales`         |
| `stream_logs`, `stop_log_stream`                                   | `LoggingService`                         |
| `spawn_process`, `list_processes`, `kill_process`, `write_process` | `ProcessService`                         |
| `run_process`                                                      | `ProcessService.RunProcess`              |
| `get_system_memory`, `get_cpu_usage`                               | `SystemService`                          |

</details>

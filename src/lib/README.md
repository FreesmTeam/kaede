[<<< Back](../README.md)

# Structure

## Browser

Kaede is a Webview-based application that requires a [Tauri](https://v2.tauri.app/) environment. Yet, in browsers, no Tauri environment exists. For one to simply test the UI of this launcher, they would need to install this application on their respective platform. However, since almost everything in Kaede was done using JavaScript, there is a way to replicate Tauri functionality using the built-in browser utilities. The `browser/` directory contains a work that is aimed at replicating Tauri API in browser environments.

Moreover, one may replace the replicas with [Wails](https://wails.io/)/[Electron](https://www.electronjs.org/)/[Electrobun](https://github.com/blackboardsh/electrobun) utils to make Kaede work with a completely different backend.

Live demo: https://kaede-basement.github.io/kaede/

### Mockups

For each package of Tauri, a subset of replicas exists.

<details>

| `@tauri-apps/api`                 | Replicas                                  |
|-----------------------------------|-------------------------------------------|
| `defaultWindowIcon()`             | None                                      |
| `invoke()`                        | Yes (see the tables below)                |
| `transformCallback()`             | Yes (a module-level callback registry)    |
| `convertFileSrc()`                | Yes (data URLs for picked images)         |
| `event.listen()` / `event.emit()` | Yes (a module-level listener registry)    |
| `Channel`                         | Yes (`onmessage` is called directly)      |

---

The file system is replicated using [Indexed DB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Indexed DB is really restricted, so for one to add a new store into the database, they need to upgrade the database version and reload the page. Therefore, Kaede database uses only one store with the OS paths as the store keys. The replica of the `mkdir` util is not needed since Indexed DB does not use a tree-based structure. Example of the database store:

| Key                                    | Value                                                                              |
|----------------------------------------|------------------------------------------------------------------------------------|
| indexed_db/config.json                 | `{ "path": "indexed_db/config.json", "value": "{\"development\":{ ... }, ... }" }` |
| indexed_db/assets/indexes/pre-1.6.json | `{ "path": "indexed_db/assets/indexed/pre-1.6.json", "value": "{ ... }" }`         |

Text files are stored as strings while binary files are stored as `File` objects.

As for the table of replicas:

| `@tauri-apps/plugin-fs`                  | Replicas             |
|------------------------------------------|----------------------|
| `copyFile()`                             | None                 |
| `create()`                               | None                 |
| `exists()`                               | Yes (IndexedDB)      |
| `lstat()`                                | Yes (same as `stat`) |
| `mkdir()`                                | Unnecessary          |
| `open()`                                 | None                 |
| `readDir()`                              | Yes (IndexedDB)      |
| `readFile()`                             | Yes (IndexedDB)      |
| `readTextFile()`                         | Yes (IndexedDB)      |
| `readTextFileLines()`                    | None                 |
| `remove()`                               | Yes (IndexedDB)      |
| `rename()`                               | Yes (IndexedDB)      |
| `size()`                                 | Yes (IndexedDB)      |
| `startAccessingSecurityScopedResource()` | None                 |
| `stat()`                                 | Yes (IndexedDB)      |
| `stopAccessingSecurityScopedResource()`  | None                 |
| `truncate()`                             | None                 |
| `watch()`                                | None                 |
| `watchImmediate()`                       | None                 |
| `writeFile()`                            | Yes (IndexedDB)      |
| `writeTextFile()`                        | Yes (IndexedDB)      |

---

The remaining Tauri plugins:

| Package                                | Replicas                                                                                 |
|----------------------------------------|------------------------------------------------------------------------------------------|
| `@tauri-apps/plugin-http`              | Yes (the whole `fetch` pipeline on top of the browser `fetch`; hosts must allow CORS)    |
| `@tauri-apps/plugin-dialog`            | Yes (`message`/`confirm`/`ask` use native dialogs; `open` copies picked files into the storage) |
| `@tauri-apps/plugin-upload`            | Yes (`download()` only)                                                                  |
| `@tauri-apps/plugin-opener`            | Yes (`openUrl()`, `revealItemInDir()`)                                                   |
| `@tauri-apps/plugin-clipboard-manager` | Yes (`writeText()` only)                                                                 |
| `@tauri-apps/plugin-os`                | Yes (static placeholders)                                                                |
| `@tauri-apps/plugin-log`               | Yes (an in-memory line buffer)                                                           |
| `tauri-plugin-shellx`                  | Yes (a placeholder result)                                                               |
| `@fabianlars/tauri-plugin-oauth`       | None (`start()` rejects: a localhost redirect server cannot exist in a browser)          |

---

The custom (`src-tauri/`) commands:

| Command                                                            | Replicas                                                        |
|--------------------------------------------------------------------|------------------------------------------------------------------|
| `get_initial_state`, `finalize_initialization`                    | Yes (placeholder state on top of IndexedDB)                     |
| `get_java_major`, `detect_java_installations`                     | Yes (there is no JVM in a browser, so placeholder answers)      |
| `verify_file_paths`, `get_missing_files`                          | Yes (IndexedDB and SubtleCrypto SHA1)                           |
| `hash_sha256`, `hash_sha1_file`                                   | Yes (SubtleCrypto)                                              |
| `hash_md5`                                                        | Yes (implemented in JavaScript since SubtleCrypto has no MD5)   |
| `concurrently_download`, `cancel_downloads`                       | Yes (browser `fetch` into IndexedDB; hosts must allow CORS)     |
| `read_archive_entry`, `unzip_files`                               | Yes (a small zip reader on top of `DecompressionStream`)        |
| `peek_mrpack`, `install_mrpack`                                   | Yes (the same zip reader)                                       |
| `read_extensions`                                                 | Yes (the same zip reader)                                       |
| `get_locales`                                                     | Yes (IndexedDB)                                                 |
| `stream_logs`, `stop_log_stream`                                  | Yes (tails the in-memory log line buffer)                       |
| `spawn_process`, `list_processes`, `kill_process`, `write_process` | Yes (placeholder processes that idle until they are killed)     |
| `run_process`                                                     | Yes (a placeholder result)                                      |
| `get_system_memory`, `get_cpu_usage`                              | Yes (JavaScript heap numbers where available, or placeholders)  |

</details>

## Wails

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


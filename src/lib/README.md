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

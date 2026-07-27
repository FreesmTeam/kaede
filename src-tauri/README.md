[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- Viewing README for Rust-related code
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Rust code

This directory contains the privileged backend boundary. TypeScript owns UI and
launcher orchestration; filesystem, network, process, dialog, archive, and
other host operations cross the typed Rust capability broker.

Some notable fields in `tauri.conf.json`:

- `macOSPrivateApi` allows to make the WebView window transparent on macOS.
- `withGlobalTauri` is disabled. Extensions never receive a raw Tauri namespace
  or `invoke` authority.
- `app.windows[0].visible` makes the WebView window hidden by default to eliminate blank screen for the WebView loading state. Once the Vue instance finishes mounting (`../src/main.ts`), the application window becomes visible.
- `app.windows[0].title` manages the window title bar.

Portable mode is determined by a `portable.txt` file next to the executable. If
the file exists, the launcher stores its data next to the executable; otherwise
it uses the system app data directory. CI therefore publishes portable
executable layouts rather than relabeling installers: Linux and Windows include
the launcher, the txiki sidecar, and the marker in one directory, while macOS
places the marker and sidecar inside the application bundle's `Contents/MacOS`
directory.

The only WebView capability is `./capabilities/main.json`. It binds the exact
`main` WebView to the two broker commands, safe app metadata, pure path
transforms, and showing the main WebView. The application manifest in
`build.rs` prevents undeclared custom commands from being callable by default.

The `./src/plugin_broker` directory includes:

- artifact principal, session, grant, scope, generation, and revocation checks;
- the strict `bootstrap_capability_broker` / `capability_call` request contract;
- host-only initial-state and finalization operations that batch parsed launcher
  documents, reuse the page-scoped launch count, create required directories,
  and probe the configured Java runtime without exposing raw invoke commands;
- host-only MD5 and SHA-256 operations over exact byte arrays; legacy raw hash
  commands remain absent from the Tauri command handler and are covered by the
  Runtime Authority negative smoke test;
- pre-prompt canonical target preparation for external roots and executables,
  with device/inode revalidation plus versioned SHA-256 executable-content
  binding when the grant is installed, sealed memfd execution on Linux, and a
  non-sharing source handle held through process creation on Windows; other
  desktop platforms reject process permissions before prompting;
- versioned, exact-principal capability history that durably prevents process
  spawn and storage write grants from being composed across sessions or restarts;
- capability-rooted storage that rejects external roots and runtime targets
  overlapping Kaede's canonical private app-data tree and rejects multiply
  linked internal or external regular files from held-handle metadata; plugin
  content I/O accepts only regular files and uses nonblocking Unix opens,
  including across regular-to-FIFO races, plus atomic decision persistence;
- redirect-aware HTTP and session-bound process/resource handling, with plugin
  child stdin closed and no broker stdin-write request;
- page/session-scoped concurrent download cancellation, exclusive destination
  leases, collision-free partial files, and atomic destination replacement.
- deterministic `.kaede` / `.zip` discovery under the runtime `extensions`
  directory, exact-root `metadata.json` and `index.js` parsing, bounded UTF-8
  decoding, isolated per-archive failures, and a SHA-256 principal digest over
  the same immutable byte snapshot that is parsed.

Run the broker and Runtime Authority checks below. On NixOS, enter the checked-in
development shell first with `nix develop` so the native build dependencies are
available.

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run test:tauri-acl
```

## Want to help?

- Feel free to do anything :3

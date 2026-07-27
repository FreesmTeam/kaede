# Portable build contract

Kaede's installed and portable distributions use the same release binary for
each platform and architecture. Portable mode is a runtime property selected by
a `portable.txt` marker next to that binary, not a separate compilation mode.
When the marker is present, Kaede stores its private state beside the executable
and changes the main window title to `Kaede Portable`.

## CI packaging

The Build workflow has four packaging matrix rows: macOS ARM, macOS x86_64,
Linux x86_64, and Windows x86_64. Each row installs its toolchain and performs
one Tauri release build after the shared validation job succeeds.
Runs on the same Git ref share a concurrency group, so a newer push or manual
run cancels stale work instead of overlapping another full packaging matrix.
Tag refs remain independent from one another.
Validation is capped at 30 minutes and each packaging row at 60 minutes to
bound runner cost if a tool or platform build hangs.

- Development runs build the normal installers and shipping application, then
  upload both the non-portable packages and a portable artifact.
- Tag runs keep the Tauri release action responsible for building and uploading
  non-portable release assets, then upload a portable workflow artifact from
  the same build output.
- macOS creates the non-portable application tarball before adding the marker
  to the application copy used by the portable archive. On tag runs, the release
  action uploads the non-portable bundles before portable packaging begins.
- Linux and Windows copy the shipping executable and sidecar into a separate
  portable layout, then add the marker there.

The portable artifact names retain the platform identifier, version, and safe
Git reference. Development non-portable artifact names retain the
`non-portable` suffix used before the matrix was consolidated.

## Validation and frontend build

The primary validation job performs the frozen Bun install and audit,
dependency compatibility check, TypeScript check, production Vite build,
declaration verification, ESLint and Oxlint, Fallow report, Vitest, RustSec
audit, Rust tests, formatting, Clippy, Hawk, and the Tauri ACL smoke. The ACL
smoke is compiled and executed by the full Rust test command, so CI does not
invoke the same test a second time.

Packaging runners rebuild the small frontend bundle locally with
`src-tauri/tauri.ci.conf.json`. This overlay runs Vite without repeating the
TypeScript check that already passed in validation. The bundle is intentionally
not transferred from validation: its local build takes about 0.7 seconds, while
uploading once and downloading on four runners would add more network setup,
storage, and failure surface than it removes.

## Local checks

Run the portable runtime test with the repository's pinned development shell:

```bash
nix develop -c cargo test --manifest-path src-tauri/Cargo.toml --locked \
  launcher::tests::portable_marker_controls_runtime_window_title -- --exact
```

Run the complete primary checks through the same commands listed in
`.github/workflows/build.yml`; the workflow remains the source of truth for
release artifact paths and conditions.

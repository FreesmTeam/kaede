# Windows 7 compatibility contract

Kaede's normal build remains on the current stable Rust toolchain and modern
frontend target. Windows 7 compatibility is isolated in the manual/reusable
`.github/workflows/windows7-compat.yml` workflow so it does not multiply the
regular four-platform packaging matrix or duplicate its validation suite.
The existing Build workflow calls this gate only for `workflow_dispatch`, which
allows a feature-branch manual run while keeping push builds unchanged.

## What the workflow proves

The workflow runs one `windows-2022` job and:

1. installs Bun 1.3.14 and the pinned `nightly-2026-06-28` Rust toolchain with
   `rust-src`;
2. checks that Rust exposes `x86_64-win7-windows-msvc` and Cargo exposes
   `-Z build-std`;
3. verifies the committed Windows txiki sidecar, then copies it to Tauri's
   custom-target filename (`txiki-server-x86_64-win7-windows-msvc.exe`);
4. performs a frozen Bun install and builds the frontend with
   `VITE_BUILD_TARGET=chrome109`;
5. exports the Win7 overlay through `TAURI_CONFIG` and runs Cargo directly with
   `--bins --features tauri/custom-protocol`, the Win7 target, release mode, the
   lockfile, and `-Z build-std` after the already-checked frontend build; this
   preserves Tauri's production compile semantics without bundling;
6. checks the produced app and the exact sidecar copied into the target output
   as AMD64 PE files whose declared subsystem version is no newer than Windows
   7 (`6.1`), and verifies the sidecar SHA-256 against the committed source.

The nightly date is deliberate. Rust does not distribute a prebuilt standard
library for the Tier-3 Win7 target, so the standard library must be built from
the matching `rust-src`. The pinned archive contains Rust 1.98 nightly, which
satisfies this repository's Rust 1.97 MSRV without downgrading the main build.
Tauri CLI 2.11.x cannot drive this target because its desktop preflight accepts
only targets listed by `rustup target list`; direct Cargo execution lets
`tauri-build` consume the same config, generate the same ACL and manifest, and
copy the target-specific sidecar without that incompatible preflight. The
explicit `tauri/custom-protocol` feature is required to embed `frontendDist`
instead of compiling Tauri's development context against `devUrl`.

## What the workflow does not prove

This is a compile contract, not a distribution or runtime certification. It
does not:

- build or install MSI/NSIS packages;
- launch Kaede on a real Windows 7 machine;
- install or smoke Microsoft Edge WebView2;
- prove that every UI path works in WebView2/Chromium 109;
- sign an executable or exercise updates.

`VITE_BUILD_TARGET=chrome109` constrains emitted JavaScript syntax; it is not a
polyfill and cannot replace a runtime smoke. Microsoft ended Windows 7 support
with Edge/WebView2 109, so that runtime is no longer receiving current security
updates.

Before publishing a Windows 7 installer, add a separate installer job and test
it on an isolated Windows 7 machine. Tauri documents that the default MSI
bootstrapper download is unsuitable for Windows 7 and recommends configuring
`bundle.windows.webviewInstallMode.type` as `embedBootstrapper`. Keep that
installer policy separate from this compile gate and verify the installed
WebView2 109 runtime plus application startup before calling a build compatible.

## Upstream contracts

- [Rust Windows baseline change](https://blog.rust-lang.org/2024/02/26/Windows-7/)
- [Rust Tier-3 Win7 target](https://doc.rust-lang.org/nightly/rustc/platform-support/win7-windows-msvc.html)
- [Cargo `build-std`](https://doc.rust-lang.org/cargo/reference/unstable.html#build-std)
- [Pinned nightly archive manifest](https://static.rust-lang.org/dist/2026-06-28/channel-rust-nightly.toml)
- [Tauri CLI target preflight](https://github.com/tauri-apps/tauri/blob/2e763a77756e13fe8c9da0c545bc1ef02730f831/crates/tauri-cli/src/interface/rust/desktop.rs)
- [Tauri build-script config and sidecar handling](https://github.com/tauri-apps/tauri/blob/2e763a77756e13fe8c9da0c545bc1ef02730f831/crates/tauri-build/src/lib.rs)
- [Tauri Windows 7 installer guidance](https://v2.tauri.app/distribute/windows-installer/#supporting-windows-7)
- [Microsoft Edge/WebView2 operating-system lifecycle](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-supported-operating-systems)

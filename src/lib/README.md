[<<< Back](../README.md)

# Library structure

## Browser preview

Kaede's frontend uses a capability broker instead of importing raw Tauri APIs throughout the
application. Desktop builds connect that broker to Tauri commands. Browser preview provides the
same launcher-facing `HostFacade` contract with browser and IndexedDB implementations where that
is practical.

This is not a general-purpose replica of `@tauri-apps/api` or the Tauri plugins. Code added to the
launcher should target the host facade or the plugin capability interfaces, according to which
trust boundary it belongs to.

Live demo: https://kaede-basement.github.io/kaede/

### Browser host facade

The host facade is for trusted launcher code. Its operations are not plugin permission grants.
Browser paths are normalized logical keys in IndexedDB rather than paths on the user's operating
system.

| Host area | Browser-preview support | Notes |
|-----------|-------------------------|-------|
| Runtime and direct app metadata | Simulated | Returns a fixed `browser-preview` runtime snapshot, Kaede app metadata, path join/normalize helpers, and a no-op main-webview show operation. |
| Native CPU and memory diagnostics | Unsupported | Fails explicitly with `UnsupportedInBrowserPreviewError`; the preview does not invent native measurements. |
| MD5 and SHA-256 hashing | Supported | Uses the typed host facade with a local `@noble/hashes` implementation; desktop builds route the same facade through host-only Rust broker operations. MD5 exists only for Minecraft's offline UUID compatibility. |
| File lookup and reads | Supported | `exists`, batch existence checks, missing-path detection, directory listing, text reads, and byte reads use IndexedDB. |
| File modification time | Unavailable | Returns `null` because IndexedDB values do not expose the desktop file timestamp contract. |
| File mutation | Partially supported | Text writes and rename are supported. Directory creation is a no-op because storage is path-keyed. The host contract has no general remove or byte-write operation; downloads and icon copies can still persist binary data. |
| SHA-1 verification | Preview approximation | It reports missing artifacts but does not calculate or compare SHA-1 values. |
| Instance icon selection | Supported | Uses a browser file picker and copies the selected bytes into IndexedDB. |
| Host HTTP | Supported | Uses browser `fetch`, including normal browser CORS and security restrictions. |
| Downloads | Supported | Streams bytes into IndexedDB and reports transfer progress. |
| Dialogs | Supported | Maps messages and questions to `alert` and `confirm`. |
| Reveal item | Simulated | Shows the logical directory contents in an alert; it cannot open an OS file manager. |
| Logging | Supported | Writes formatted entries to the browser log buffer. |
| ZIP extraction | Unsupported | Fails explicitly with `UnsupportedInBrowserPreviewError`. |
| Installed `.kaede` / `.zip` archives | Unavailable | Returns an empty archive result; browser preview does not scan the desktop extensions directory. |
| Java probing, Minecraft processes, and process control | Unsupported | Fails explicitly with `UnsupportedInBrowserPreviewError`. |
| Txiki code/file servers | Unsupported | Fails explicitly with `UnsupportedInBrowserPreviewError`. |

### Browser plugin capabilities

Plugins do not receive the host facade. They receive capability objects only after the matching
permission descriptor has been granted to their session. A session revoke clears all grants.

| Plugin permission | Browser-preview support | Scope enforcement |
|-------------------|-------------------------|-------------------|
| `ui/basic` | Handled by the extension UI sandbox | This is a UI authorization boundary, not a callable plugin capability factory. |
| `ui/forms/non-credential` | Handled by the extension UI sandbox | This is a UI authorization boundary, not a callable plugin capability factory. |
| `network/http` | Supported with browser limitations | Each approved origin/method rule remains exact and cumulative. Every visible redirect hop is re-authorized with Fetch redirect-method semantics; opaque redirects that cannot be inspected safely are rejected. Browser CORS still applies. |
| `storage/internal/read` | Supported | Reads bytes or text below the exact plugin principal's IndexedDB namespace. |
| `storage/internal/write` | Supported | Writes bytes or text and removes values below the exact plugin principal's IndexedDB namespace. |
| `storage/external/read` | Supported as logical preview storage | Reads only below explicitly granted root keys and rejects traversal in relative paths. It does not expose the OS filesystem. |
| `storage/external/write` | Supported as logical preview storage | Writes bytes or text and removes values only below explicitly granted root keys; relative-path traversal is rejected. |
| `system/process/spawn` | Unsupported | The grant is checked, then the operation fails explicitly with `UnsupportedInBrowserPreviewError`. |
| `system/shell` | Unsupported | The grant is checked, then the operation fails explicitly with `UnsupportedInBrowserPreviewError`. |
| `events/subscribe` | Supported when configured | Uses the principal-specific frontend event capability factory. |
| `logging/write` | Supported | Writes plugin-attributed entries to the browser log buffer. |

Browser preview cannot resolve operating-system filesystem objects. Its
permission preparation therefore labels external roots as identity-stable
logical IndexedDB keys, and labels process executables as unsupported. These
labels participate in remembered-decision fingerprints without claiming a
desktop canonical path, device, inode, or executable digest. Desktop process
grants accept only the Rust-confirmed `desktop-executable-sha256-v1` identity;
external roots retain their separate `desktop-filesystem-v1` identity.

The distinction matters for operations such as remove, rename, and binary writes: rename is a host
file operation; scoped plugin write capabilities expose remove and binary writes; and the host
facade intentionally does not expose a general remove or byte-write method.

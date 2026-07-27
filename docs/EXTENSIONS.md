# Extensions

Kaede extensions are JavaScript artifacts loaded at runtime. This document uses
the terms _extension_, _plugin_, and _add-on_ interchangeably.

## Trust model

Kaede has two extension repositories:

- [Kaede Add-ons User Repository (KAUR)](https://github.com/kaede-basement/kaur)
  contains community plugins. They are untrusted and run in separate Secure
  ECMAScript (SES) compartments.
- [trusted-extensions](https://github.com/kaede-basement/trusted-extensions)
  contains plugins reviewed as part of Kaede's trusted computing base (TCB).
  Repository membership alone does not grant trust.

There is no setting that promotes a community artifact to the TCB. A community
plugin declared as `unrestricted` is rejected instead of running outside a
compartment.

Before unrestricted execution, the host requires an exact match in Kaede's
baked trusted-artifact catalog: canonical repository origin, plugin ID,
version, and SHA-256 artifact digest. The writable metadata `source` field is
informational and cannot add an artifact to the TCB; for a catalog match, the
principal uses the catalog's canonical repository origin even when metadata
points to an upstream raw artifact URL.

The catalog is the host verification boundary. Adding or updating a trusted
artifact requires a reviewed Kaede change that records the new exact digest
and reviewed repository commit. Publishing a file or changing repository
metadata cannot update trust policy at runtime.

Kaede identifies an installed artifact by this complete principal:

```text
canonical repository origin + plugin ID + version + SHA-256 artifact digest
```

Changing the version, ID, or even one byte of code creates a new principal.
For sandboxed artifacts the canonical metadata source is also part of the
principal. Permission decisions from an older artifact do not carry over.

## Security boundary

Kaede uses one Tauri WebView. Trusted plugins execute in metadata order, then
Kaede removes its extension-facing globals and calls SES lockdown with
`evalTaming: "safe-eval"`. Every enabled untrusted artifact then receives:

- its own SES `Compartment`;
- an opaque broker session retained by host closures, never by plugin code;
- one closed `ShadowRoot` and one Ark `SafeDocument`;
- only the hardened capabilities granted to its exact principal.

`window.__TAURI__`, raw `invoke`, Tauri plugin APIs, broker tokens, the host
facade, `window.__KAEDE__`, and `window.__KAEDE_INTERNALS__` are not sandbox
capabilities. Tauri's runtime allowlist exposes only the broker bootstrap/call,
safe app metadata, pure path transforms, and showing the main WebView. Broker
bootstrap is one-shot for each page load.

The Rust broker checks the active session, artifact principal, permission,
scope, and arguments for every privileged operation. File roots, processes,
and other resource handles are bound to that session. Unload, update, or page
reload disposes the `SafeDocument`, removes event listeners, revokes the
session, and closes bound processes.

### Non-goal: application availability

The boundary protects the computer and privileged host authority. It does not
promise to keep Kaede responsive when a plugin loops forever, allocates memory,
or overloads the CPU or GPU. Ark and Kaede deliberately do not expose fixed
DOM, listener, canvas, request, memory, or rate quotas as a security claim.

## Permission lifecycle

Permissions declared in plugin metadata are static. Before the first run of an
exact artifact, Kaede shows the complete set and offers `Run` or `Cancel`.
Dangerous permissions are highlighted. The decision is stored only for that
artifact principal.

An already running sandbox can request more authority:

```ts
(async () => {
  const grant = await requestPermissions([
    {
      id: "network/http",
      scope: {
        origins: ["https://api.example.com"],
        methods: ["GET"],
      },
    },
  ]);

  if (grant.granted.includes("network/http")) {
    const response = await grant.capabilities["network/http"]?.fetch({
      url: "https://api.example.com/status",
      method: "GET",
      headers: [],
    });
  }
})().catch((error) => {
  throw error;
});
```

Sandbox source is evaluated as a script by an SES `Compartment`, so top-level
`await` is not available. Keep the async IIFE as the final expression: Kaede
awaits its promise, and rethrowing from the rejection handler lets the plugin
initialization lifecycle report the failure and clean up the sandbox.

`requestPermissions()` opens a separate dynamic prompt and returns a new,
deeply hardened result. It never mutates the original `scopedThis` object:

```ts
type PermissionGrant = Readonly<{
  granted: readonly PermissionId[];
  denied: readonly PermissionId[];
  capabilities: Readonly<Partial<PluginCapabilities>>;
}>;
```

Remembering a dynamic decision is optional and remains bound to the exact
artifact and normalized scope. Before either a static or dynamic decision is
looked up, the desktop broker resolves every external storage root and process
executable to a canonical filesystem path and records its filesystem object
identity. A process target also carries a versioned SHA-256 digest of the exact
native executable bytes. That confirmed material is what the prompt displays
and fingerprints. An unchanged target can reuse the decision on a later launch;
a retargeted symlink, replaced target, or in-place executable overwrite has a
different fingerprint and prompts again.
Principal v2 keys hash the complete canonical repository/artifact principal,
and request v2 keys hash the complete prepared descriptor and every confirmed
target identity. Static-set v2 keys hash the sorted request keys. These
versioned SHA-256 keys keep even long valid principals and scopes within the
persistent-store key limit without dropping exact artifact, scope, or object
binding.

Static decisions and explicitly remembered dynamic decisions do not complete
until the decision store confirms its durable save. A failed save rejects the
permission request before Kaede opens a static plugin session or applies a
dynamic broker grant; it is never treated as a remembered session-only allow.

## Permission catalog

Simple permissions remain strings. Permissions that require scope are objects.

| Permission | Scope and capability |
| --- | --- |
| `ui/basic` | A ready-to-use Ark `SafeDocument` with safe inline style properties. |
| `ui/forms/non-credential` | Static policy modifier for non-credential form controls; it does not return a separate capability. |
| `network/http` | Exact HTTP(S) origins and methods. Every redirect is authorized again. |
| `storage/internal/read` | Read relative paths under the artifact principal directory. |
| `storage/internal/write` | Write and remove relative paths under the principal directory. |
| `storage/external/read` | Read `{ root, relativePath }` under confirmed canonical roots. |
| `storage/external/write` | Write and remove `{ root, relativePath }` under confirmed canonical roots. |
| `system/process/spawn` | Exact executable path and exact argument vector. |
| `system/shell` | Arbitrary shell script execution; separate critical permission. |
| `events/subscribe` | Immutable primitive/array/plain-record event snapshots. |
| `logging/write` | Structured plugin-owned launcher log entries. |

`system/process/spawn` and storage write permissions are mutually exclusive for
one exact artifact principal. Kaede rejects a static or dynamic request that
combines them. Before the Rust authorizer installs either family, it durably
records the principal's first family in a separate versioned history file; the
opposite family remains denied across reloads, revocation, remembered or
session-only decisions, and application restarts. Storage read permissions may
coexist with process spawn. This fail-closed rule prevents a plugin from using
its own broker write authority in another session to change interpreter inputs
after the process rule was approved. A changed artifact digest creates a new
principal. If history cannot be read, written, and synced, no affected grant is
installed; a family recorded just before a later session error remains a
conservative permanent choice for that exact principal.

External storage operations use directory capabilities opened when the grant is
accepted. The grant rechecks the prompt-confirmed filesystem identity before it
installs the capability. Relative operations remain beneath that directory
identity even if a same-user process races to replace an ancestor with a
symlink or Windows reparse point. External storage can never overlap Kaede's
canonical private application-data root in either direction: a filesystem or
home ancestor, the application-data directory itself, and every child are all
non-delegable. The broker enforces this when preparing a root and again for each
canonical read, write, remove, or not-yet-created sibling target, so a legacy or
constructed grant cannot address decisions, capability history, atomic
temporary files, or other private Kaede data. Principal-owned internal storage
remains available only through its separate relative-path capability. Every
internal or external plugin content read/write requires a regular file. On
Unix, the broker opens the capability-relative target with `O_NONBLOCK` and
validates metadata from that held object before reading, truncating, or writing,
so FIFOs, sockets, devices, directories, and regular-to-special-file races fail
without retaining the operation lease. A missing write target is still created
as a regular file. Internal and external regular files must also have exactly
one filesystem link; Kaede does not support hard-linked plugin storage objects.
Read, write, and remove reject hard-linked aliases using metadata from an
already-held file handle. This also prevents an internal principal directory
from being used as a content alias to another principal or private broker
state. Writes perform both checks before truncation and then modify the same
held object. Remove opens only regular-file candidates with
nonblocking metadata access, so FIFOs and other special entries are unlinked
without a content open and a write-only single-link file keeps ordinary unlink
semantics. Ordinary single-link files remain supported. Process grants
likewise recheck the confirmed path, device, inode, and content digest
when installed. Every spawn request recomputes that digest together with the
exact canonical path and argument vector. On Linux the broker hashes bytes
while copying them into an executable memfd, seals that snapshot against writes
and size changes, and executes the sealed descriptor with the canonical path
preserved as `argv[0]`; a concurrent external write can therefore affect the
source path but not the approved bytes that run. On Windows the broker hashes
through a held handle opened with read sharing only, which denies writes and
deletion until process creation returns. Executable scripts must instead be
expressed as an exact native-interpreter rule plus exact script arguments.
macOS and other platforms that cannot provide the same binding reject process
permissions before the prompt. Traversal components and absolute
plugin-internal paths are rejected.

A plugin process handle exposes only its PID, `kill()`, `wait()`, and captured
stdout/stderr lifecycle results. The child starts with closed/null stdin; plugin
code has no process-stdin write capability.

Network grants do not widen DOM authority after startup. Static `network/http`
GET origins build the Ark URL policy when the `SafeDocument` is created. A
later dynamic network grant enables broker fetch only; it does not change the
existing DOM URL policy.

`ui/forms/non-credential` must be present statically because Ark's form policy
is fixed when the document is created. Dynamic requests cannot turn credential
controls on later.

## Sandboxed plugins

The initial capabilities are available through `scopedThis`. `ui/basic`
returns the plugin's existing `SafeDocument`, not a document factory:

```ts
const safeDocument = scopedThis["ui/basic"];

if (safeDocument) {
  const message = safeDocument.createParagraph();

  message.setText("Hello from a sandboxed plugin");
  safeDocument.appendChild(message);
}
```

Ark owns DOM validation, ownership, lifecycle revocation, rollback, URL/style/
form policy, and normalized exceptions. Arbitrary `<style>` content in the
application document remains a trusted-theme feature; sandboxed plugins use
the fixed safe inline-style property set.

Plugins may subscribe more than once to immutable events. All subscriptions
for the artifact principal are removed during teardown even if the plugin did
not call the returned unsubscribe functions.

### Plugin Playground

The Plugin Playground is a non-executing scratchpad. Pasted code has no
verified artifact identity or permission decision, so Kaede does not evaluate
it or expose trusted launcher helpers to it. Install the draft as a sandbox
extension to run it through the artifact-bound SES and permission lifecycle.

## Trusted plugins

Trusted plugins are cooperative TCB code and can affect all launcher behavior.
They execute through an async function before lockdown and receive an explicit
context as both `this` and `scopedThis`:

```ts
const { Host, DirectHost, Kaede } = scopedThis;
```

- `Host` contains typed launcher filesystem, HTTP, download, dialog, logging,
  process, Minecraft, archive, and server operations.
- `DirectHost` contains only app metadata, pure path transforms, and main
  WebView display.
- `Kaede` is the mutable launcher namespace used by trusted hooks and UI
  extensions.

`Kaede.libs.Schemas.*Validator.Check(value)` is synchronous. Detailed errors
are intentionally failure-only chunks, so `Errors(value)` returns a promise:

```ts
const errors = await Kaede.libs.Schemas.ConfigValidator.Errors(candidate);
```

Do not read `.length` or iterate the return value before awaiting it.

`Host.downloads.batch()` groups concurrent launcher downloads behind the Rust
broker and `Host.downloads.cancel()` cancels only batches with the same
session-, page-generation-, and caller-supplied cancellation ID. Destination
paths remain exclusively leased until each batch releases them.

`Kaede.libs.Txiki` is a trusted-plugin-only convenience builder. It serializes
trusted route callbacks and globals, then starts the generated server through
`Host.servers`; it is never injected into an untrusted SES compartment or the
non-executing Plugin Playground. Server ports are allocated atomically by the
sidecar and operating system with port `0`, instead of being selected in
renderer code. The broker returns the opaque server handle and actual port only
after the sidecar reports that it is listening; early exit or a missing
readiness signal fails startup and cleans up the process.

Trusted code may capture this context before Kaede removes the corresponding
window globals. This is intentionally powerful and is why exact catalog
identity is enforced before execution.

Top-level `await` is supported.

## Metadata example

```json
{
  "id": "example.plugin",
  "name": "Example Plugin",
  "logo": "example.png",
  "type": "sandbox",
  "source": "https://github.com/example/example-plugin",
  "version": "1.0.0",
  "authors": ["Example"],
  "languages": ["en"],
  "categories": ["utility"],
  "enabled": true,
  "permissions": [
    "ui/basic",
    "logging/write",
    {
      "id": "storage/internal/write",
      "scope": { "directory": "principal" }
    }
  ]
}
```

Repository URLs, plugin IDs, versions, origins, paths, methods, and executable
rules must already be in their canonical forms. Invalid or duplicate artifact
metadata fails closed.

## Installed artifacts

Place extension artifacts in the launcher's `extensions` directory. The
preferred package is a `.kaede` archive; `.zip` is accepted with the same
format. Both required files must be at the archive root:

```text
metadata.json
index.js
```

`metadata.json` must satisfy Kaede's extension metadata schema. Both entries
must be UTF-8 (an optional UTF-8 BOM is accepted); metadata is limited to 64
KiB and code to 16 MiB, checked against both declared and decompressed size.
Kaede hashes the exact archive-byte snapshot that it parses, so any code,
metadata, or packaging change creates a new artifact principal.

Archives are scanned in deterministic filename order. One malformed archive is
reported and skipped without hiding other valid archives. Duplicate extension
IDs across archives or legacy files fail the combined load. Legacy top-level
`.js` files and their entries in `extensions.json` remain supported during the
migration; archive metadata is embedded and does not need a second entry in
that file.

## TypeScript

Kaede publishes separate declaration entrypoints for the mutually exclusive
plugin contexts. Keep the required files together without renaming them:

- [`kaede-lib.d.ts`](../types/kaede-lib.d.ts) — shared types only; no injected
  plugin context;
- [`kaede-sandbox.d.ts`](../types/kaede-sandbox.d.ts) — sandbox `scopedThis`
  capabilities and `requestPermissions`, bundled without trusted bootstrap
  aliases;
- [`kaede-trusted.d.ts`](../types/kaede-trusted.d.ts) — trusted `scopedThis`
  with `Host`, `DirectHost`, and `Kaede`;
- [`ark-of-atrahasis-1.0.d.ts`](../types/ark-of-atrahasis-1.0.d.ts) — the
  vendored Ark declaration dependency;
- [`package.json`](../types/package.json) — preserves ESM declaration semantics
  under Node16 and NodeNext resolution.

A sandbox plugin needs the sandbox entrypoint, Ark snapshot, and type-folder
`package.json`. A trusted plugin needs the trusted entrypoint, `kaede-lib.d.ts`,
the Ark snapshot, and the type-folder `package.json`. Because the full trusted
Kaede namespace exposes Vue and TypeBox-backed fields, trusted/shared type
consumers must also make the `vue` and `typebox` versions listed in Kaede's
root `package.json` available to TypeScript. The standalone sandbox entrypoint
does not require them.

Reference exactly one context entrypoint from plugin source, adjusting the
relative path to the copied declarations:

```ts
/// <reference path="./types/kaede-sandbox.d.ts" />
```

For a trusted plugin, use:

```ts
/// <reference path="./types/kaede-trusted.d.ts" />
```

Do not include both context entrypoints in one TypeScript program. Doing so
would conflate sandbox and trusted authority even though Kaede never injects
both contexts at runtime. Reference `kaede-lib.d.ts` alone when only shared
types are needed.

Regenerate all public declarations after a public API change:

```bash
bun run generate:types
```

Kaede currently consumes Ark 1.0 from the exact audited fork commit. Replace
that source alias with the official package after the upstream maintainer
publishes `ark-of-atrahasis@1.0.0`.

## Themes

Themes are trusted CSS files ending in `.css`. Kaede reads one directory level
inside its themes folder. Themes are not sandbox `ui/basic` capabilities and
may style the application document directly.

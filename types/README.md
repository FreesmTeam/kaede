[<<< Back](../docs/README.md)

# Types

This directory contains the generated public declarations for Kaede plugins:

- `kaede-lib.d.ts` contains shared types, permission descriptors, immutable
  grants, typed capabilities, and the trusted host contracts. It does not
  inject a plugin execution context.
- `kaede-sandbox.d.ts` is a standalone sandbox bundle that injects only
  `scopedThis` and `requestPermissions`.
- `kaede-trusted.d.ts` injects the trusted `scopedThis` context with `Host`,
  `DirectHost`, and `Kaede`. It does not inject `requestPermissions`.
- `ark-of-atrahasis-1.0.d.ts` is the vendored declaration dependency used by
  the shared `ui/basic` capability type.
- `package.json` preserves ESM declaration semantics when the type files are
  copied into a CommonJS project and compiled with Node16 or NodeNext
  resolution.

Do not install or call Tauri plugin APIs from an extension. Sandboxed plugins
receive only declared `PluginCapabilities`; trusted plugins receive the typed
`Host`, `DirectHost`, and `Kaede` context before lockdown. See
[`docs/EXTENSIONS.md`](../docs/EXTENSIONS.md) for examples and scope rules.
The `Kaede.libs.Txiki` route builder belongs to this trusted context only and
serves generated code through the typed host broker; it is intentionally absent
from `kaede-sandbox.d.ts`.

For a sandboxed plugin, copy `kaede-sandbox.d.ts`,
`ark-of-atrahasis-1.0.d.ts`, and `package.json` together without renaming them,
then reference the sandbox entrypoint (adjust the relative path as needed):

```ts
/// <reference path="./types/kaede-sandbox.d.ts" />
```

For a trusted plugin, copy `kaede-trusted.d.ts`, `kaede-lib.d.ts`, the Ark
snapshot, and `package.json`, then reference the trusted entrypoint:

```ts
/// <reference path="./types/kaede-trusted.d.ts" />
```

Do not load both context entrypoints into one TypeScript program. Their
`scopedThis` globals intentionally describe mutually exclusive runtime trust
boundaries. Consumers that only import shared types can use `kaede-lib.d.ts`
without receiving either ambient plugin context.

The full shared/trusted namespace preserves the types of Kaede's public Vue
and TypeBox-backed fields. A trusted or shared-type consumer must therefore
make the `vue` and `typebox` versions listed in Kaede's root `package.json`
available to TypeScript. The standalone sandbox entrypoint has no such
dependency.

Generated schema checks remain synchronous, while detailed TypeBox errors are
loaded only for failed validation. Trusted consumers must therefore `await`
`Kaede.libs.Schemas.*Validator.Errors(value)`.

`kaede-lib.d.ts` is post-processed so it has no repository-private path aliases.
Its Ark references resolve to the sibling `ark-of-atrahasis-1.0.d.ts` snapshot,
which preserves the complete `SafeDocument` contract for consumers even though
the pinned Git dependency does not contain a built `dist` directory.

The Ark snapshot is the byte-exact `dist/index.d.ts` built from version 1.0.0 at
commit `928f1f361abaa4d7204de0bb53dd7b916b04d45b`. Its SHA-256 is
`79f17ec644dc0e8b23ffe246b71637083e3f6c2172acc8ba7966ef519b31e4db`.

Regenerate the Kaede declarations after a public contract change:

```bash
bun run generate:types
```

Verify the checked-in output, the Ark snapshot hash, positive examples,
negative authority tests, and external TypeScript consumability under bundler,
Node16, and NodeNext resolution:

```bash
bun run check:types
```

## Demonstration

![A demonstration of the type declarations by IntelliSense](../docs/assets/kaede-lib-typescript.png)

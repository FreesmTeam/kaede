[<<< Back](../docs/README.md#contributing)

- Viewing README for TypeScript-related code
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Frontend & backend code

This folder contains Vue UI and TypeScript launcher orchestration. Privileged
host operations use the typed capability facade backed by Rust instead of raw
Tauri plugin calls. Type checks are provided by TypeScript at build time and
[TypeBox](https://github.com/sinclairzx81/typebox) at runtime.

## Top-level files

- `App.vue` is the Vue entry point file.
  - HTML-wise, it contains an application layout with error boundaries.
  - Code-wise, it contains a deeply `reactive` global-state object and a
    `shallowReactive` Minecraft instance-state object.

> [!IMPORTANT]
> Gathering application states in one place is discouraged and considered to be amateurish. Not only this practice goes against all software developing principles, but it also introduces less manageable state structure in the whole application.
>
> **However**, this practice allows Kaede to have global states that are easily accessible and extensible by trusted plugins. Nested fields in the global `reactive` object remain observable without replacing their parent object, while the field hooks and configuration synchronization continue to use the shared state contract.
>
> Moreover, this approach allows extension hooks to have a well-defined behaviour, since all global states are stored in `App.vue` and do not disappear with the component unmount. One can suggest `Pinia` to manage global stores, but according to [Pinia docs [1]](#references), "you cannot add a new state property if you don't define it in `state()`."
> 
> *The globally-accessible `HookMappings` object should be changed to contain a `key: value` mapping for the custom reactive field.

- `declarations.ts` is the public plugin declaration entry point. It describes
  trusted context, launcher namespaces, permissions, and sandbox capabilities.
  Note: the second argument of the `HookReturnType` type accepts `"nothing"`
  and any other type (including `void`). However, `void` and `"nothing"` values
  serve different purposes:
  - `void` means that the hook returns `{ "status": "stop" | "continue", "response": void }`. Hooks with this type can control whether to continue caller's code execution or not (caller is the function that executes these hooks).
  - `"nothing"` means that the hook returns `void` (or anything else, the caller will just not care about it). Hooks with this type cannot abort caller's code execution.
- `globals.css` contain global CSS styles that are not possible or not convenient to write using the UnoCSS.
- `main.ts` is the main entry point file. It handles all initialization code and CSS styles. This code will be executed the first when the WebView will load.
- `vite-env.d.ts` is simply a default file that the `vite` bundler generates.

## Top-level folders

Every folder has its own `README` file for more detailed explanations.

- `__mocks__` contain library mocks that exist purely for the testing environment. [More](./__mocks__/README.md)
- `components` contain only Vue components. Those components are used in the application UI. [More](./components/README.md)
- `constants` contain reusable global constants. [More](./constants/README.md)
- `lib` contains the backend part. [More](./lib/README.md)
- `resources` contain application assets, i.e. images, GIFs, or videos. [More](./resources/README.md)
- `types` contain reusable TypeScript types and interfaces. [More](./types/README.md)

## Bundle size

Last measured from `bun run build:frontend` on 28.07.2026. Values are the
minified JavaScript chunks before gzip; image and CSS assets are excluded.

| Logical chunk | Minified |
|---------------|----------|
| sandbox dependencies | 304.0 kB |
| application entry | 156.5 kB |
| framework dependencies | 152.0 kB |
| other dependencies | 85.3 kB |
| server management | 100.8 kB |
| editor dependencies | 29.6 kB |
| desktop capability adapter | 18.5 kB |
| permission preparation | 7.5 kB |
| plugin playground | 4.4 kB |
| remaining runtime chunks | 21.2 kB |
| **Total JavaScript** | **879.7 kB** |

`bun generate:bundle-analysis` writes the ignored `bundle-analysis.html`
source-map report. The production report contains only the SHA-256 branch of
`@noble/hashes` (about 4.4 KiB) for synchronous capability fingerprints; MD5 is
tree-shaken from the desktop bundle and remains available only to browser
preview. Desktop launcher MD5/SHA-256 work goes through host-only typed broker
operations backed by Rust.

# References

- [[1] Pinia Documentation: Accessing the state](https://pinia.vuejs.org/core-concepts/state.html#Accessing-the-state)

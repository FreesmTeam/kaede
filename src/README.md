[<<< Back](../docs/README.md#contributing)

- Viewing README for TypeScript-related code
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Frontend & backend code

This folder contains frontend-specific and backend-specific code. The frontend uses Vue.js, and the backend uses Tauri API. Type checks are provided by TypeScript (build time) and [TypeBox](https://github.com/sinclairzx81/typebox) (runtime).

## Top-level files

- `App.vue` is the Vue entry point file.
  - HTML-wise, it contains an application layout with error boundaries.
  - Code-wise, it contains two `shallowReactive` objects that store global states and Minecraft instance states.

> [!IMPORTANT]
> Gathering application states in one place is discouraged and considered to be amateurish. Not only this practice goes against all software developing principles, but it also introduces less manageable state structure in the whole application.
>
> **However**, this practice allows Kaede to have global states that are easily accessible and extensible by user plugins. For example, creating a new **reactive** field in the global `shallowReactive` object will (almost*) automatically implement all the needed field hooks, handle the configuration file syncing, and allow other plugins to use that field for their needs.
>
> Moreover, this approach allows extension hooks to have a well-defined behaviour, since all global states are stored in `App.vue` and do not disappear with the component unmount. One can suggest `Pinia` to manage global stores, but according to [Pinia docs [1]](#references), "you cannot add a new state property if you don't define it in `state()`."
> 
> *The globally-accessible `HookMappings` object should be changed to contain a `key: value` mapping for the custom reactive field.

- `declarations.ts` contain the `window` type definitions. Without those definitions, TypeScript does not know about the custom `window.__KAEDE__` namespace. Note: the second argument of the `HookReturnType` type accepts `"nothing"` and any other type (including `void`). However, `void` and `"nothing"` values serve different purposes:
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

Last updated: `a4357d5d8c4585e449ca4d877aaff36a46a550bb` (27.07.2026)

| Part                             | Minified |
|----------------------------------|----------|
| `src/`                           | 205.9 KB |
| `typebox`                        | 115.2 KB |
| `vue`                            | 110.5 KB |
| `ses`                            | 76.2 KB  |
| `@daidr/minecraft-skin-renderer` | 46.8 KB  |
| `@tanstack/vue-query`            | 35.4 KB  |
| `vue-virtualised`                | 34.4 KB  |
| tauri-plugins                    | 26.7 KB  |
| `prism-code-editor`              | 25.7 KB  |
| `jshashes`                       | 22.3 KB  |
| `ark-of-atrahasis`               | 17.0 KB  |
| `m3ripple-vue`                   | 7.2 KB   |
| `@vueuse/core`                   | 6.6 KB   |
| `serialize-javascript`           | 3.3 KB   |
| bundler code?                    | ~4.1 KB  |
| Total                            | 737.3 KB |

# References

- [[1] Pinia Documentation: Accessing the state](https://pinia.vuejs.org/core-concepts/state.html#Accessing-the-state)

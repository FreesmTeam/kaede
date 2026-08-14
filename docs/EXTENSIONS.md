# Extensions

## General

### Introduction

Kaede extensions are pieces of JavaScript code that change the User Interface (UI) or functionality of a launcher. They are loaded at runtime and are not included by default. Extensions can be written by anyone.

> [!NOTE]
> The documentation will use terms "add-on", "plugin", and "extension" interchangeably.

### Format

Plugins are stored in the `extensions` folder and represent [ZIP](https://en.wikipedia.org/wiki/ZIP_(file_format)) archive files that use [DEFLATE](https://en.wikipedia.org/wiki/Deflate) compression. They can have either `.zip` or `.kaede` file extension. Every plugin archive should have two files: (1) `index.js` and (2) `metadata.json`. The `index.js` file is the code that will be executed, and `metadata.json` is a plugin metadata that has the following type.

> [!NOTE]
> The SHA256 hash of `index.js` is calculated for Kaede to know which plugin was enabled by the user. Even if the ID of a plugin stays the same but the hash changes, the plugin will be automatically disabled.

```ts
type MetadataType = {
  "logo"      : string;
  "name"      : string;
  "type"      : "sandbox" | "unrestricted";
  "source"    : string;
  "version"   : string;
  "authors"   : Array<string>;
  // Use ISO 639-1 two-letter language codes
  "languages" : Array<string>;
  "categories": Array<string>;
} & Partial<{
  "description": string;
  "permissions": Array<PermissionType>;
  "enabled"    : boolean;
}>;
```

An example of a valid metadata:

```json
{
  "logo": "",
  "name": "Better UI reload",
  "source": "",
  "version": "",
  "authors": ["notwindstone"],
  "languages": [],
  "categories": [],
  "type": "unrestricted"
}
```

Please note that the file name of a ZIP archive file acts as a plugin ID.

### Repositories

Plugin repository is a place that stores and distributes plugins. Additional repositories can be added although Kaede has two built-in plugin repositories.

The first one is a [Kaede User Repository (KUR)](https://github.com/kaede-basement/kur), similar to [Arch User Repository (AUR)](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). KUR contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions) where I publish my extensions. Others may publish as well but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something seems fishy. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Balancing between the safety, performance, and developer experience (DX) of plugins is hard, especially since I am the only developer of this project. Surely, various approaches to ensure the security of user plugins exist:

- embedding user components via `<iframe />`;
- using Web Workers for an arbitrary code;
- running another JavaScript engine (either in WebAssembly or JavaScript itself) to execute the code;
- [ShadowRealm (continuation of realms-shim)](https://tc39.es/proposal-shadowrealm/);
- executing JS plugins in another WebView window spawned by Tauri with no permissions.

Every approach above has its advantages, but there are also disadvantages. Consequently, satisfying all three requirements might be impossible. Therefore, I propose the following idea: separate extensions into sandboxed and unrestricted types. Sandboxed ones will focus on security while unrestricted ones are made for performance and DX.

<table>
  <thead>
    <tr>
      <th></th>
      <th>Sandboxed</th>
      <th>Unrestricted</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Safety</strong></td>
      <td>Uses Android-like permissions and <a href="https://www.npmjs.com/package/ses" target="_blank">Secure ECMAScript Compartments</a></td>
      <td>Nothing stops the plugin from deleting your whole system after stealing MSA tokens</td>
    </tr>
    <tr>
      <td><strong>Performance</strong></td>
      <td>
        <blockquote>When using direct eval, especially when the eval source cannot be proven to be in strict mode, the engine — and build tools — have to disable all optimizations related to inlining, because the eval() source can depend on any variable name in its surrounding scope<br />- Source: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_direct_eval!">MDN</a></blockquote>
        Also, all provided to the plugin utilities are wrapped into another functions that have lots of checks for security purposes, making code run a little bit slower.<br />
        However, the code still runs in the same engine context, so it should be faster than a regular interpretation or even code executed in iframes.
      </td>
      <td>Faster than the sandboxed plugins and should be really close to a non-dynamically-initialized code.</td>
    </tr>
    <tr>
      <td><strong>Developer Experience</strong></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

> [!CAUTION]
> There is always a small chance the sandbox will be broken, which will allow the plugin to act like an unrestricted plugin

The restricted environment (sandbox) uses a permission-based system. When enabling the plugin for the first time, the list of static permissions will be shown. Static permissions are defined ahead-of-time. In case the plugin wants to extend its capabilities, it can use the `requestPermissions` function that returns a promise that resolves as soon as the user allows the request. `requestPermissions` is a plugin-scoped global variable that is essentially a reference to the function from another lexical environment, i.e., Kaede itself.

// write here uhh i forgot

// remove or move: A restricted environment is achieved by using a [Secure ECMAScript](https://github.com/endojs/endo) framework. Each permission has its own list of globals passed to the plugin. Unfortunately, almost every DOM operation is prohibited since it leads to the sandbox escape.

// remove or move: The second one is an unrestricted environment that allows plugins to do everything that the Kaede can do itself. Trusted extensions are executed in this environment.

// remove or move: Settings have an option to enable the execution of KUR extensions that require an unrestricted environment. Since those extensions may be harmful, the option is disabled by default.

### Benchmarks

```js
const container = document.createElement("div");

container.style.position = "absolute";
container.style.height = "fit-content";
container.style.left = "0";
container.style.top = "0";

document.getElementById("app").append(container);

const start = performance.now();

for (let index = 0; index < 10_000; index++) {
  const child = document.createElement("div");
  child.textContent = index;
  child.className = "text-neutral-300";
  container.appendChild(child);
}

// Average time across 5 runs - 6,72 ms
const result = performance.now() - start;
```

```js
const gui = scopedThis["ui-basic"]("app");
const performance = scopedThis["time::performance"].performance;
const container = gui.createDiv();

container.style.position = "absolute";
container.style.height = "fit-content";
container.style.left = "0";
container.style.top = "0";

gui.getElement("app").appendChild(container);

const start = performance.now();

for (let index = 0; index < 10_000; index++) {
  const child = gui.createDiv();
  child.setText(index);
  child.setClass("text-neutral-300");
  container.appendChild(child);
}

// Average time across 5 runs - 29,42 ms
const result = performance.now() - start;
```

## Making a Plugin

### TypeScript

The usage of TypeScript in Kaede plugins is possible via another [plugin](https://github.com/kaede-basement/trusted-extensions/tree/main/plugins/typescript-chan).

### Unrestricted

A top-level `await` is supported since the plugin code is executed via an async function constructor:

```ts
const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;
```

Function constructors allow a dynamic creation of functions with arbitrary code within the same JavaScript engine context as of Kaede. Therefore, JIT compiler optimizations are also applicable to plugins.

For further details about this environment, expand the next section.

Getting deeper >>>

<details>

### Hook System

A hook system in Kaede is a powerful technique that allows plugins to intercept functions. 

### Tauri API

- hook system (`window.__KAEDE__.hooks`)
- tauri api accessing
- tauri community plugins accessing
- possibility to monkey-patch literally every Kaede functionality
- a variety of Kaede helper functions
- other things that i do not remember rn

</details>

### Sandboxed

For further details about this environment, expand the next section.

The unexplored isolation >>>

<details>

TO-DO explain:

- safe bidirectional events system (hooks alternative)
- make a list of permissions and their corresponding functionality grant
- performance
- Secure ECMAScript

</details>

## Making a Theme

Theming is possible via CSS. Themes should represent files that end with the `.css` extension. Kaede will pick up one-level deep CSS files in the `themes` folder.

Every DOM element has a unique `id` attribute. In case the element is attached to a dynamic list (`<... v-for="..." />`), it will also have a unique class name.

The `id` attribute uses BEM methodology for naming.

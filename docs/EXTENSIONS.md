# Extensions

## General

### Introduction

Kaede extensions are pieces of JavaScript code that change the User Interface (UI) or functionality of a launcher. They are loaded at runtime and are not included by default. Extensions can be written by anyone.

> [!NOTE]
> The documentation will use terms "add-on", "plugin", and "extension" interchangeably.

### Repositories

Plugin repository is a place that stores and distributes plugins. Additional repositories can be added although Kaede has two built-in plugin repositories.

The first one is a [Kaede Add-ons User Repository (KAUR)](https://github.com/kaede-basement/kaur), similar to [Arch User Repository (AUR)](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). KAUR contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions). I publish my extensions there. Others may publish as well but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something seems fishy. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Balancing between the safety, performance, and developer experience of plugins is hard, especially since I am the only developer of this project. Surely, various approaches to ensure the security of user plugins exist:

- embedding user components via `<iframe />`;
- using Web Workers for an arbitrary code;
- running another JavaScript engine (either in WebAssembly or JavaScript itself) to execute the code;
- 

Therefore, I propose the following idea: separate extensions into sandboxed and unrestricted types. So, extensions can be loaded in two environments.

The first one is a restricted environment (sandbox) that uses a permission-based system. When enabling the plugin for the first time, the list of static permissions will be shown. Static permissions are defined ahead-of-time. In case the plugin wants to extend its capabilities, it can use the `requestPermissions` function that returns a promise that resolves as soon as the user allows the request. `requestPermissions` is a plugin-scoped global variable that is essentially a reference to the function from another lexical environment, i.e., Kaede itself.

KAUR extensions are executed in this environment.

A restricted environment is achieved by using a [Secure ECMAScript](https://github.com/endojs/endo) framework. Each permission has its own list of globals passed to the plugin. Unfortunately, almost every DOM operation is prohibited since it leads to the sandbox escape.

The second one is an unrestricted environment that allows plugins to do everything that the Kaede can do itself. Trusted extensions are executed in this environment.

Settings have an option to enable the execution of KAUR extensions that require an unrestricted environment. Since those extensions may be harmful, the option is disabled by default.

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

[<<< Back](../README.md)

# `components` folder

This folder contains only Vue components. All components use [Composition API](https://vuejs.org/guide/extras/composition-api-faq.html) with TypeScript.

## Top-level folders

- `general` contains all **reusable** components that do not correspond to any specific page.
- `logging` contains all components that are used only on the `Log Viewer` screen.
- `add-instance` contains all components that are used only on the `Add Instance` page.
- `home` contains all components that are used only on the `Home` page.
- `library` contains all components that are used only on the `Library` page.
- `settings` contains all components that are used only on the `Settings` page.
- `profile` contains all components that are used only on the `Profile` page.

### `general` folder

- `base` contains basic UI blocks with pre-defined styles and logic, i.e. buttons, inputs, or sliders.
- `development-mode` contains components for the enabled development mode.
- `errors` contain error boundaries.
- `extensions` contain components for the extension system, i.e. a viewer for the plugin repository, a modal element for the permission request by a plugin at runtime, or a viewer for the installed plugins.
- `layout` contains components that define the application UI structure, i.e. a sidebar or a context menu.
- `misc` contains all other components.

## Styles

### `z-index` table

| Elements                | Value  |
|-------------------------|--------|
| `dev` FPS counter       | `9500` |
| Context Menu            | `9000` |
| Permissions Modal       | `8000` |
| Generic Modal           | `7500` |
| Sidebar Tooltip         | `7000` |
| Launch Progressbar      | `6500` |
| Log Viewer              | `6000` |
| Sidebar                 | `5000` |
| Config Sync Icon        | `1500` |
| Dropdown                | `50`   |
| Other absolute elements | `10`   |
| Global Background       | `-10`  |

/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* eslint-disable max-lines */
import { confirm } from "@tauri-apps/plugin-dialog";
import { computed, type ShallowReactive, shallowReactive } from "vue";

import { DefaultLocale, DefaultLocaleName } from "@/constants/application.ts";
import Permissions from "@/constants/permissions.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/log.ts";
import Modals from "@/lib/modals";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import { javaStates } from "@/states/java.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";
import type { JavaInstallationType } from "@/types/launcher/java-installation.type.ts";
import type { SettingsRowCollectionType } from "@/types/ui/settings-row.type.ts";

const emptyPermissions = [
  {
    "icon"       : "__kaede-do-not-render",
    "title"      : "None",
    "description": "This extensions does not have any static permissions.",
  },
];

const extensionHandler = {
  "generic": async (
    index: number,
    extension: ExtensionType,
    cleanEnable: () => Promise<void>,
  ): Promise<void> => {
    const enabled: boolean = globalStates.extensions.list[index].enabled;

    /*
     * If extensions are disabled, we are allowing free-toggling.
     * 'ExtensionLoader.vue' handles the disabling of all executed extensions,
     * so no worries here
     */
    if (!globalStates.extensions.enabled) {
      globalStates.extensions.list[index].enabled = !enabled;

      return;
    }

    /*
     * If we import 'Extensions' from our 'libs/' folder, then we will break our
     * code-splitting, adding more than 100 KB of packages ('SES', 'ark-of-atrahasis', etc.)
     * to the index JavaScript file. Those packages are loaded only when extensions feature
     * are enabled, and since this code changes extensions, we can imply that the extensions
     * are enabled.
     *
     * Another scenario is that the user has enabled extensions, loaded extensions
     * (therefore, making these 'extensionHandler' variable functions accessible), and then
     * disabled extensions while still having these functions accessible. In such case,
     * everything will still work as 'ExtensionLoader' was already loaded, making 'Extensions'
     * and the rest of the libs stay exposed to globals
     *
     * UPD: Yeah, I have tested the output. With direct imports:
     *
     * ```
     * dist/assets/ExtensionLoader-DeFIFzDe.js       14.43 kB │ gzip:   5.70 kB
     * dist/assets/PluginPlayground-C6G2CMXN.js      30.28 kB │ gzip:  13.36 kB
     * dist/assets/index-CD2zf8AX.js                 73.45 kB │ gzip:  20.75 kB
     * dist/assets/index-CKXFTzdX.js                518.37 kB │ gzip: 164.68 kB
     * ```
     *
     * Without direct imports (via 'GlobalObject.libs.Extensions'):
     *
     * ```
     * dist/assets/PluginPlayground-CCMrxMdk.js      30.28 kB │ gzip:  13.36 kB
     * dist/assets/index-CC3e8Kpc.js                 73.45 kB │ gzip:  20.75 kB
     * dist/assets/ExtensionLoader-BJ6kEj8G.js      116.04 kB │ gzip:  37.97 kB
     * dist/assets/index-Co3Wt_c7.js                416.64 kB │ gzip: 131.89 kB
     * ```
     */
    const Extensions = GlobalObject.libs.Extensions;
    const needsCleanRun: boolean = await Extensions.dirtyLifecycle(
      extensionStates.executed,
      extension,
      !enabled,
    );

    // Dirty lifecycle handler executed if 'needsCleanRun' is true
    if (!needsCleanRun) {
      globalStates.extensions.list[index].enabled = !enabled;

      return;
    }

    /*
     * Lifecycle handlers were not found if we got here with 'enabled' being true...
     * This means, that the extension is shown as enabled, yet the execution wasn't made,
     * so now we make it disabled.
     *
     * Re-enabling won't trigger 'globalStates.extensions.list[index].enabled = true',
     * the thing to note is that 'globalStates.extensions.list[index].enabled' can be true
     * if the user loaded extensions, disabled extensions loading, and enabled an extension
     * that in the next run didn't launch. Wait, then we should probably show the extension as
     * disabled?
     *
     * Alright, I tried handling this scenario, so this branch is essentially useless,
     * but let it stay as a memorial. Holy shit why all of this is so complex,
     * I try to code everything as simple as possible...
     *
     * Wait, this branch is not useless if user played around with enabling extensions feature
     * and 'allowUnrestrictedUntrusted' while having the toggle for an unrestricted extension,
     * which leads to dirty lifecycle handlers being undefined
     */
    if (enabled) {
      globalStates.extensions.list[index].enabled = !enabled;

      return;
    }

    try {
      await cleanEnable();

      globalStates.extensions.list[index].enabled = true;
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while re-enabling extension '${extension.id}' (sha256: ${extension.sha256}):`,
        Errors.prettify(error),
      );
    }
  },
  "trusted": (index: number, extension: ExtensionType): Promise<void> => {
    return extensionHandler.generic(
      index,
      extension,
      async (): Promise<void> => {
        /*
         * See the comments above for explanations for why we don't import directly
         */
        const Extensions = GlobalObject.libs.Extensions;
        const api = await Extensions.runInUnrestricted(
          extension.id,
          extension.code,
          extension.metadata,
          extension.sha256,
        );

        if (!api) {
          throw new Error("Failed to run extension");
        }

        extensionStates.executed = [
          ...extensionStates.executed,
          { extension, api },
        ];
      },
    );
  },
  "communityUnrestricted": async (index: number, extension: ExtensionType): Promise<void> => {
    const alreadyEnabled: boolean = globalStates.extensions.list[index].enabled;
    const confirmed: boolean = alreadyEnabled || await Modals.confirm({
      "title"      : "Enabling the plugin",
      "description": `Do you really want to enable the '${extension.metadata.name}' plugin` +
        ` (ID: '${extension.id}')? Only enable if you trust the author of this plugin.` +
        " This plugin will be able to perform actions listed below" +
        " and cause irreversible harm to your device.",
      "icon": "i-lucide-circle-alert",
      "rows": [
        {
          "icon"       : "__kaede-do-not-render",
          "title"      : "Interact with your File System",
          "description": "This includes but is not limited to: reading your Minecraft accounts," +
            " deleting the system files, and changing the contents of any files.",
        },
        {
          "icon"       : "__kaede-do-not-render",
          "title"      : "Launch and install programs",
          "description": "The plugin may run shell commands (e.g., 'rm -rf /')," +
            " install harmful software, and open any program on your device.",
        },
        {
          "icon"       : "__kaede-do-not-render",
          "title"      : "Access the internet",
          "description": "Any URL is accessible for this plugin, meaning it can send there" +
            " important data from your device.",
        },
        {
          "icon"       : "__kaede-do-not-render",
          "title"      : "Other",
          "description": "It can modify Kaede user interface so that a regular launch button will" +
            " launch two programs (Minecraft and a malicious one) at the same time.",
        },
      ],
    });

    if (!confirmed) {
      return;
    }

    return extensionHandler.trusted(index, extension);
  },
  "communitySandboxed": async (index: number, extension: ExtensionType): Promise<void> => {
    const alreadyEnabled: boolean = globalStates.extensions.list[index].enabled;
    const mappedRows = (extension.metadata?.permissions ?? []).map(currentPermission => {
      const displayData =Permissions.getPermissionDisplayData(currentPermission);

      return {
        "icon"       : displayData.icon,
        "title"      : General.capitalize(displayData.label),
        "description": displayData.description,
      };
    });
    const confirmed: boolean = alreadyEnabled || await Modals.confirm({
      "title"      : "Enabling the plugin",
      "description": `Do you really want to enable the '${extension.metadata.name}' plugin` +
        ` (ID: '${extension.id}')? This plugin will be able to perform actions listed below.`,
      "icon": "i-lucide-circle-alert",
      "rows": mappedRows.length > 0 ? mappedRows : emptyPermissions,
    });

    if (!confirmed) {
      return;
    }

    return extensionHandler.generic(
      index,
      extension,
      async (): Promise<void> => {
        const permissions = extension.metadata.permissions ?? [];

        /*
         * See the comments above for explanations for why we don't import directly
         */
        const Extensions = GlobalObject.libs.Extensions;
        // This is a sync function, but the lifecycle handlers might be async
        const api = Extensions.runInSandbox(
          { "id": extension.id, permissions, "code": extension.code },
        );

        if (!api) {
          throw new Error("Failed to run extension");
        }

        extensionStates.executed = [
          ...extensionStates.executed,
          { extension, api },
        ];
      },
    );
  },
} as const;

export const ExtensionsSettingsRows: SettingsRowCollectionType = [
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-enabled",
    "icon"    : "i-lucide-blocks",
    "title"   : "Enable extensions",
    "subtitle": "Load trusted or community-made extensions",
    "onClick" : async (): Promise<void> => {
      const toToggle: boolean = await confirm(
        globalStates.extensions.enabled
          ? (
            "Do you really want to disable all executed extensions?" +
            "\n" +
            "Note that you need to reload the UI to fully disable all extensions."
          )
          : "Do you really want to enable the extension system?",
        "Extensions",
      );

      if (!toToggle) {
        return;
      }

      globalStates.extensions.enabled = !globalStates.extensions.enabled;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.extensions.enabled,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-allow-untrusted",
    "icon"    : "i-lucide-door-open",
    "title"   : "Allow unrestricted untrusted extensions",
    "subtitle": "Allow community extensions to run outside of the sandbox",
    "onClick" : async (): Promise<void> => {
      if (!globalStates.extensions.allowUnrestrictedUntrusted) {
        const toEnable: boolean = await confirm(
          "By enabling this option, you are allowing" +
          " " +
          "community-made extensions to run with all permissions." +
          "\n" +
          "They will be able to access internet and your file system." +
          "\n" +
          "\n" +
          "Are you sure?",
          "Extensions",
        );

        if (!toEnable) {
          return;
        }
      }

      globalStates.extensions.allowUnrestrictedUntrusted =
        !globalStates.extensions.allowUnrestrictedUntrusted;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.extensions.allowUnrestrictedUntrusted,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-show-after-initialization",
    "icon"    : "i-lucide-clock",
    "title"   : "Show the window after extensions load",
    "subtitle": "Wait for extensions to initialize before showing the launcher window",
    "onClick" : (): void => {
      globalStates.extensions.showAppAfterExtensionsLoad =
        !globalStates.extensions.showAppAfterExtensionsLoad;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.extensions.showAppAfterExtensionsLoad,
    },
  })),

  computed(() => ({
    "idRoot"  : "__settings-page__extensions-separator-1",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-list-trusted",
    "icon"    : "i-lucide-shield-check",
    "title"   : "Trusted extensions",
    "subtitle": "Enable or disable safe extensions",
    "inner"   : extensionStates
      .valid
      .filter(({ sha256 }) => trustedExtensionHashes.value.has(sha256))
      .map(currentExtension => {
        const { id, metadata, sha256 } = currentExtension;
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-trusted-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} / unknown`,
            "subtitle": metadata?.description,
          };
        }

        const isInExecuted: boolean = extensionStates.executed.some(searching => (
          searching.extension.sha256 === sha256
        ));
        const status: string = isInExecuted ? "<executed> " : "";

        return {
          "idRoot"  : `__settings-page__extensions-list-trusted-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : `${status}${metadata.name}`,
          "subtitle": metadata?.description,
          "onClick" : (): Promise<void> => extensionHandler.trusted(index, currentExtension),
          "inner"   : {
            "kind" : "toggle",
            "value": globalStates.extensions.list[index].enabled,
          },
        };
      }),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-trusted-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No trusted extensions loaded",
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-list-sandboxed",
    "icon"    : "i-lucide-brick-wall",
    "title"   : "Sandboxed community extensions",
    "subtitle": "Enable or disable community extensions running in a sandbox",
    "inner"   : extensionStates
      .valid
      .filter(({ metadata }) => metadata.type === "sandbox")
      .map(currentExtension => {
        const { id, metadata, sha256 } = currentExtension;
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-sandboxed-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} / unknown`,
            "subtitle": metadata?.description,
          };
        }

        const isInExecuted: boolean = extensionStates.executed.some(searching => (
          searching.extension.sha256 === sha256
        ));
        const status: string = isInExecuted ? "<executed> " : "";

        return {
          "idRoot"  : `__settings-page__extensions-list-sandboxed-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : `${status}${metadata.name}`,
          "subtitle": metadata?.description,
          "onClick" : (): Promise<void> => (
            extensionHandler.communitySandboxed(index, currentExtension)
          ),
          "inner": {
            "kind" : "toggle",
            "value": globalStates.extensions.list[index].enabled,
          },
        };
      }),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-sandboxed-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No sandboxed community extensions loaded",
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-list-unrestricted",
    "icon"    : "i-lucide-triangle-alert",
    "title"   : "Unrestricted community extensions",
    "subtitle": "Enable or disable unsafe extensions",
    "inner"   : extensionStates
      .valid
      .filter(({ metadata, sha256 }) => (
        metadata.type === "unrestricted" &&
        !trustedExtensionHashes.value.has(sha256)
      ))
      .map(currentExtension => {
        const { id, metadata, sha256 } = currentExtension;
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-unrestricted-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} / unknown`,
            "subtitle": metadata?.description,
          };
        }

        const isInExecuted: boolean = extensionStates.executed.some(searching => (
          searching.extension.sha256 === sha256
        ));
        const status: string = isInExecuted ? "<executed> " : "";

        return {
          "idRoot"  : `__settings-page__extensions-list-unrestricted-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : `${status}${metadata.name}`,
          "subtitle": metadata?.description,
          // Allow extension disabling but not enabling when 'allowUnrestrictedUntrusted' is false
          "disabled": (
            !globalStates.extensions.allowUnrestrictedUntrusted &&
            !globalStates.extensions.list[index].enabled
          ),
          "onClick": (): Promise<void> => (
            extensionHandler.communityUnrestricted(index, currentExtension)
          ),
          "inner": {
            "kind" : "toggle",
            "value": globalStates.extensions.list[index].enabled,
          },
        };
      }),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-unrestricted-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No unrestricted community extensions loaded",
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-list-invalid",
    "icon"    : "i-lucide-file-question-mark",
    "title"   : "Invalid extensions",
    "subtitle": "See what extensions did not load properly",
    "inner"   : extensionStates
      .invalid
      .map(entry => ({
        "idRoot"  : `__settings-page__extensions-list-invalid-entry-${entry?.id}`,
        "image"   : entry?.metadata?.logo,
        "title"   : entry?.metadata?.name ?? entry?.id ?? "unknown",
        "subtitle": entry?.metadata?.description,
      })),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-invalid-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No invalid extensions",
    },
  })),
];

export const DevelopmentSettingsRows: SettingsRowCollectionType = [
  computed(() => ({
    "idRoot"  : "__settings-page__development-enable-debug-mode",
    "icon"    : "i-lucide-bug",
    "title"   : "Enable debug mode",
    "subtitle": "Start logging debug messages",
    "onClick" : (): void => {
      globalStates.development.enableDebugMode = !globalStates.development.enableDebugMode;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.enableDebugMode,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-load-eruda-dev-tools",
    "icon"    : "i-lucide-tool-case",
    "title"   : "Enable DevTools",
    "subtitle": "Fetch and load the Eruda console for debugging",
    "onClick" : (): void => {
      globalStates.development.loadErudaDevTools = !globalStates.development.loadErudaDevTools;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.loadErudaDevTools,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-separator-1",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-show-fps",
    "icon"    : "i-lucide-gauge",
    "title"   : "Show FPS",
    "subtitle": "Display the current FPS",
    "onClick" : (): void => {
      globalStates.development.showFPS = !globalStates.development.showFPS;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.showFPS,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-show-cpu-usage",
    "icon"    : "i-lucide-cpu",
    "title"   : "Show CPU usage",
    "subtitle": "Display current CPU usage",
    "onClick" : (): void => {
      globalStates.development.showCPUUsage = !globalStates.development.showCPUUsage;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.showCPUUsage,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-show-memory-usage",
    "icon"    : "i-lucide-memory-stick",
    "title"   : "Show RAM usage",
    "subtitle": "Display current RAM consumption",
    "onClick" : (): void => {
      globalStates.development.showMemoryUsage = !globalStates.development.showMemoryUsage;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.showMemoryUsage,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-separator-2",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-enable-native-context-menu",
    "icon"    : "i-lucide-mouse-pointer-click",
    "title"   : "Native context menu",
    "subtitle": "Display the OS right‑click menu alongside the custom one",
    "onClick" : (): void => {
      globalStates.development.enableNativeContextMenu =
        !globalStates.development.enableNativeContextMenu;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.enableNativeContextMenu,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-enable-native-reload-key-binds",
    "icon"    : "i-lucide-refresh-cw",
    "title"   : "Native reload keybinds",
    "subtitle": "Allow Ctrl+R / F5 keys to reload the window",
    "onClick" : (): void => {
      globalStates.development.enableNativeReloadKeyBinds =
        !globalStates.development.enableNativeReloadKeyBinds;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.enableNativeReloadKeyBinds,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__development-use-native-color-picker",
    "icon"    : "i-lucide-pipette",
    "title"   : "Native color picker",
    "subtitle": "Use the OS color picker instead of the custom one",
    "onClick" : (): void => {
      globalStates.development.useNativeColorPicker =
        !globalStates.development.useNativeColorPicker;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.development.useNativeColorPicker,
    },
  })),
];

export const ReadLocales = shallowReactive([
  { "id": DefaultLocale, "label": DefaultLocaleName },
]);
export const UserInterfaceSettingsRows: SettingsRowCollectionType = [
  computed(() => ({
    "idRoot"  : "__settings-page__ui-locale",
    "icon"    : "i-lucide-languages",
    "title"   : "Language",
    "subtitle": "Change the launcher language",
    "inner"   : {
      "kind"    : "select",
      "options" : ReadLocales,
      "value"   : globalStates.locale,
      "onSelect": (value: { "id": string; "label": string }): void => {
        globalStates.locale = value.id;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-logs-line-height",
    "icon"    : "i-lucide-unfold-vertical",
    "title"   : "Log line height",
    "subtitle": "Adjust the height of log lines in the log viewer",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-unfold-vertical",
      "placeholder" : "Line height",
      "debounceTime": 300,
      "defaultValue": globalStates.logs.lineHeight,
      "onInput"     : (value: string): void => {
        const parsed: number = Number(value);

        if (Number.isNaN(parsed)) {
          return;
        }

        globalStates.logs.lineHeight = parsed;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-separator-1",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-ripple-color",
    "icon"    : "i-lucide-droplet",
    "title"   : "Ripple color",
    "subtitle": "Color of the Material You ripple",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.ripple.color,
      "onColor": (value: string): void => {
        globalStates.ui.ripple.color = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-ripple-sparkles",
    "icon"    : "i-lucide-sparkles",
    "title"   : "Sparkles color",
    "subtitle": "Color of the Material You sparkles",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.ripple.sparkles,
      "onColor": (value: string): void => {
        globalStates.ui.ripple.sparkles = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-separator-2",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-background-image",
    "icon"    : "i-lucide-image",
    "title"   : "Background",
    "subtitle": "Display a custom background image or video",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-image",
      "placeholder" : "Background image",
      "debounceTime": 300,
      "defaultValue": globalStates.ui.background.image ?? undefined,
      "onInput"     : (value: string): void => {
        globalStates.ui.background.image = value === "" ? null : value;
      },
      "filePicker": {
        "icon"   : "i-lucide-folder-open",
        "title"  : "Select an image/video file",
        "filters": [{
          "name"      : "Media",
          "extensions": ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "apng", "mp4", "webm"],
        }],
        "onPick": (value: string): void => {
          globalStates.ui.background.image = value;
        },
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-background-blur",
    "icon"    : "i-lucide-square-dashed",
    "title"   : "Background blur",
    "subtitle": "Amount of blur applied to the background",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-square-dashed",
      "placeholder" : "Background blur",
      "debounceTime": 300,
      "defaultValue": globalStates.ui.background.blur ?? undefined,
      "onInput"     : (value: string): void => {
        if (value === "") {
          globalStates.ui.background.blur = null;

          return;
        }

        const parsed: number = Number(value);

        if (Number.isNaN(parsed)) {
          return;
        }

        globalStates.ui.background.blur = parsed;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-background-color",
    "icon"    : "i-lucide-palette",
    "title"   : "Overlay color",
    "subtitle": "Overlay color shown on top of the background",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.background.color,
      "default": "#1c1c1c99",
      "onColor": (value: string): void => {
        globalStates.ui.background.color = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-background-is-video",
    "icon"    : "i-lucide-film",
    "title"   : "Background video",
    "subtitle": "Render the background as a video",
    "onClick" : (): void => {
      globalStates.ui.background.isVideo = !globalStates.ui.background.isVideo;
    },
    "inner": {
      "kind" : "toggle",
      "value": globalStates.ui.background.isVideo ?? false,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-separator-3",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-text-font",
    "icon"    : "i-lucide-type",
    "title"   : "Font",
    "subtitle": "Font family used across the launcher",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-type",
      "placeholder" : "Font family",
      "debounceTime": 300,
      "defaultValue": globalStates.ui.text.font ?? undefined,
      "onInput"     : (value: string): void => {
        globalStates.ui.text.font = value === "" ? null : value;
      },
      "filePicker": {
        "icon"   : "i-lucide-folder-open",
        "title"  : "Select a font file",
        "filters": [{
          "name"      : "Font",
          "extensions": ["ttf", "otf", "woff", "woff2"],
        }],
        "onPick": (value: string): void => {
          globalStates.ui.text.font = value;
        },
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-text-main-color",
    "icon"    : "i-lucide-baseline",
    "title"   : "Main color",
    "subtitle": "Select the main text color",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.text.mainColor,
      "default": "#FFFFFF",
      "onColor": (value: string): void => {
        globalStates.ui.text.mainColor = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-text-secondary-color",
    "icon"    : "i-lucide-baseline",
    "title"   : "Secondary color",
    "subtitle": "Select the secondary text color",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.text.secondaryColor,
      "default": "#A3A3A3",
      "onColor": (value: string): void => {
        globalStates.ui.text.secondaryColor = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-separator-4",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-widget-background",
    "icon"    : "i-lucide-square",
    "title"   : "Widget background color",
    "subtitle": "Select the background color of widgets",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.widget.background,
      "default": "#0a0a0a",
      "onColor": (value: string): void => {
        globalStates.ui.widget.background = value;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-widget-blur",
    "icon"    : "i-lucide-square-dashed",
    "title"   : "Widget blur",
    "subtitle": "Apply blur to widget backgrounds",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-square-dashed",
      "placeholder" : "Widget blur",
      "debounceTime": 300,
      "defaultValue": globalStates.ui.widget.blur ?? undefined,
      "onInput"     : (value: string): void => {
        if (value === "") {
          globalStates.ui.widget.blur = null;

          return;
        }

        const parsed: number = Number(value);

        if (Number.isNaN(parsed)) {
          return;
        }

        globalStates.ui.widget.blur = parsed;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-widget-text-color",
    "icon"    : "i-lucide-baseline",
    "title"   : "Widget text color",
    "subtitle": "Select the main text color of widgets",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.widget.textColor,
      "default": "#FFFFFF",
      "onColor": (value: string): void => {
        globalStates.ui.widget.textColor = value;
      },
      "toBottom": false,
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__ui-widget-secondary-color",
    "icon"    : "i-lucide-baseline",
    "title"   : "Widget secondary color",
    "subtitle": "Select the secondary text color of widgets",
    "inner"   : {
      "kind"   : "color",
      "value"  : globalStates.ui.widget.secondaryColor,
      "default": "#D4D4D4",
      "onColor": (value: string): void => {
        globalStates.ui.widget.secondaryColor = value;
      },
      "toBottom": false,
    },
  })),
];

export const MinecraftSettingsRows: SettingsRowCollectionType = [
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-window-width",
    "icon"    : "i-lucide-move-horizontal",
    "title"   : "Window width",
    "subtitle": "The default value in pixels for instances",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-move-horizontal",
      "placeholder" : "Window width",
      "debounceTime": 300,
      "defaultValue": globalStates.minecraft.windowWidth,
      "onInput"     : (value: string): void => {
        const parsed: number = Number(value);

        if (Number.isNaN(parsed)) {
          return;
        }

        globalStates.minecraft.windowWidth = parsed;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-window-height",
    "icon"    : "i-lucide-move-vertical",
    "title"   : "Window height",
    "subtitle": "The default value in pixels for instances",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-move-vertical",
      "placeholder" : "Window height",
      "debounceTime": 300,
      "defaultValue": globalStates.minecraft.windowHeight,
      "onInput"     : (value: string): void => {
        const parsed: number = Number(value);

        if (Number.isNaN(parsed)) {
          return;
        }

        globalStates.minecraft.windowHeight = parsed;
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-icon",
    "icon"    : "i-lucide-image",
    "title"   : "Instance icon",
    "subtitle": "Default icon used for new instances",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-image",
      "placeholder" : "Instance icon",
      "debounceTime": 300,
      "defaultValue": globalStates.minecraft.icon,
      "onInput"     : (value: string): void => {
        globalStates.minecraft.icon = value;
      },
      "filePicker": {
        "icon"   : "i-lucide-folder-open",
        "title"  : "Select an image file",
        "filters": [{
          "name"      : "Media",
          "extensions": ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "apng"],
        }],
        "onPick": (value: string): void => {
          globalStates.minecraft.icon = value;
        },
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-separator-1",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-add-jvm-arguments",
    "icon"    : "i-lucide-plus",
    "title"   : "Additional JVM arguments",
    "subtitle": "Extra JVM arguments appended on launch",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-plus",
      "placeholder" : "Arguments",
      "debounceTime": 300,
      "defaultValue": Launcher.Arguments.joinArguments(globalStates.minecraft.add.jvmArguments),
      "onInput"     : (value: string): void => {
        globalStates.minecraft.add.jvmArguments = Launcher.Arguments.splitArguments(value);
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-add-game-arguments",
    "icon"    : "i-lucide-plus",
    "title"   : "Additional game arguments",
    "subtitle": "Extra game arguments appended on launch",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-plus",
      "placeholder" : "Arguments",
      "debounceTime": 300,
      "defaultValue": Launcher.Arguments.joinArguments(globalStates.minecraft.add.gameArguments),
      "onInput"     : (value: string): void => {
        globalStates.minecraft.add.gameArguments = Launcher.Arguments.splitArguments(value);
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-separator-2",
    "separate": "~",
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-remove-jvm-arguments",
    "icon"    : "i-lucide-minus",
    "title"   : "Removed JVM arguments",
    "subtitle": "JVM arguments removed on launch",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-minus",
      "placeholder" : "Arguments",
      "debounceTime": 300,
      "defaultValue": Launcher.Arguments.joinArguments(globalStates.minecraft.remove.jvmArguments),
      "onInput"     : (value: string): void => {
        globalStates.minecraft.remove.jvmArguments = Launcher.Arguments.splitArguments(value);
      },
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__minecraft-remove-game-arguments",
    "icon"    : "i-lucide-minus",
    "title"   : "Removed game arguments",
    "subtitle": "Game arguments removed on launch",
    "inner"   : {
      "kind"        : "input",
      "icon"        : "i-lucide-minus",
      "placeholder" : "Arguments",
      "debounceTime": 300,
      "defaultValue": Launcher.Arguments.joinArguments(globalStates.minecraft.remove.gameArguments),
      "onInput"     : (value: string): void => {
        globalStates.minecraft.remove.gameArguments = Launcher.Arguments.splitArguments(value);
      },
    },
  })),
];

function formatJavaTitle(installation: JavaInstallationType): string {
  return `${installation.vendor} ${installation.version}`.trim();
}

export const JavaSettingsRows: SettingsRowCollectionType = [
  computed(() => {
    const available = javaStates
      .installations
      .map(installation => ({
        "idRoot"  : `__settings-page__java-detected-entry-${installation.path}`,
        "icon"    : "i-lucide-coffee",
        "title"   : formatJavaTitle(installation),
        "subtitle": installation.path,
        "onClick" : (): void => {
          globalStates.minecraft.javaBinary = installation.path;
        },
        "inner": {
          // Without 'as const' TypeScript throws errors
          "kind" : "radio" as const,
          "value": globalStates.minecraft.javaBinary === installation.path,
        },
      }));

    if (javaStates.environment !== null) {
      available.unshift({
        "idRoot"  : "__settings-page__java-environment-entry",
        "icon"    : "i-lucide-star",
        "title"   : formatJavaTitle(javaStates.environment),
        "subtitle": "java",
        "onClick" : (): void => {
          globalStates.minecraft.javaBinary = "java";
        },
        "inner": {
          "kind" : "radio",
          "value": globalStates.minecraft.javaBinary === "java",
        },
      });
    }

    for (const [index, custom] of globalStates.java.entries()) {
      available.push({
        "idRoot"  : `__settings-page__java-custom-entry-${index}`,
        "icon"    : "i-lucide-file-cog",
        "title"   : custom.label,
        "subtitle": custom.path,
        "onClick" : (): void => {
          globalStates.minecraft.javaBinary = custom.path;
        },
        "inner": {
          "kind" : "radio",
          "value": globalStates.minecraft.javaBinary === custom.path,
        },
      });
    }

    return {
      "idRoot"  : "__settings-page__java-detected",
      "icon"    : "i-lucide-file-search",
      "title"   : "Java paths",
      "subtitle": "All runtimes found in the system",
      "inner"   : available,
      "empty"   : {
        "idRoot"  : "__settings-page__java-detected-empty",
        "icon"    : "__kaede-do-not-render",
        "subtitle": "No Java runtimes found",
      },
    };
  }),
];
export const CustomRows: ShallowReactive<
  Record<string, SettingsRowCollectionType>
> = shallowReactive({});

export default {
  DevelopmentSettingsRows,
  ExtensionsSettingsRows,
  ReadLocales,
  UserInterfaceSettingsRows,
  MinecraftSettingsRows,
  JavaSettingsRows,
  CustomRows,
} as const;

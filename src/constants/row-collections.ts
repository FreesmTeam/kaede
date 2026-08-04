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
import { computed } from "vue";

import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";
import type { SettingsRowCollectionType } from "@/types/ui/settings-row.type.ts";

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
     * Another scenario is that user has enabled extensions, loaded extensions
     * (therefore, making these 'extensionHandler' variable functions accessible), and then
     * disabled extensions while still having these functions accessible. In such case,
     * everything will still work as 'ExtensionLoader' was already loaded, making 'Extensions'
     * and the rest of the libs exposed to globals
     *
     * UPD: Yeah, I have tested the output. With direct imports:
     * ```
     * dist/assets/ExtensionLoader-DeFIFzDe.js       14.43 kB │ gzip:   5.70 kB
     * dist/assets/PluginPlayground-C6G2CMXN.js      30.28 kB │ gzip:  13.36 kB
     * dist/assets/index-CD2zf8AX.js                 73.45 kB │ gzip:  20.75 kB
     * dist/assets/index-CKXFTzdX.js                518.37 kB │ gzip: 164.68 kB
     * ```
     *
     * Without direct imports (via 'GlobalObject.libs.Extensions'):
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
  "communityUnrestricted": (index: number, extension: ExtensionType): Promise<void> => {
    // TODO: confirm user choice for community unrestricted

    return extensionHandler.trusted(index, extension);
  },
  "communitySandboxed": (index: number, extension: ExtensionType): Promise<void> => {
    // TODO: confirm user choice for community sandboxed (with static permissions)

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
    "title"   : "Show window after extensions load",
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
      "subtitle": "No invalid extensions loaded",
    },
  })),
];

export default {
  ExtensionsSettingsRows,
} as const;

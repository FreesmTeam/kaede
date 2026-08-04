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
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { computed } from "vue";

import Errors from "@/lib/errors";
import Extensions from "@/lib/extensions";
import { log } from "@/lib/logging/log.ts";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";
import type { SettingsRowCollectionType } from "@/types/ui/settings-row.type.ts";

type ExecutedExtension = (typeof extensionStates)["executed"][number];

const extensionHandler = {
  "generic": async (
    index: number,
    extension: ExtensionType,
    cleanEnable: () => Promise<void>,
  ): Promise<void> => {
    const executed: ExecutedExtension | undefined = extensionStates.executed.find(searching => (
      searching.sha256 === extension.sha256
    ));
    const enabled: boolean = globalStates.extensions.list[index].enabled;

    // If extensions are disabled, we are just forcing any toggling to be a 'disable' action
    if (!globalStates.extensions.enabled) {
      globalStates.extensions.list[index].enabled = false;

      return;
    }

    if (enabled) {
      try {
        if (extension.metadata.type === "sandbox") {
          await message(
            `The extension '${extension.id}' will be fully disabled with the next UI reload`,
          );

          globalStates.extensions.list[index].enabled = false;

          return;
        }

        if (executed === undefined) {
          throw new Error("Tried to disable an extension that does not have Extension API");
        }

        await executed.api.disable();

        globalStates.extensions.list[index].enabled = false;
      } catch (error: unknown) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          `Error while disabling extensions '${extension.id}' (sha256: ${extension.sha256})`,
          Errors.prettify(error),
        );
      }

      return;
    }

    try {
      await (
        executed === undefined
          ? cleanEnable()
          : executed.api.enable()
      );

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
        const result = await Extensions.runInUnrestricted(
          extension.id,
          extension.code,
          extension.metadata,
          extension.sha256,
        );

        if (!result) {
          throw new Error("Failed to run extension");
        }

        extensionStates.executed.push(
          { "id": extension.id, "sha256": extension.sha256, "api": result },
        );
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

        // Make sure to lock down the environment...
        Extensions.lockdownEnvironment();

        // This is a sync function
        Extensions.runInSandbox({ "id": extension.id, permissions, "code": extension.code });
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

        const status: string = extensionStates.executed.some(searching => (
          searching.sha256 === sha256
        )) ? "<executed> " : "";

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

        const status: string = extensionStates.executed.some(searching => (
          searching.sha256 === sha256
        )) ? "<executed> " : "";

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

        const status: string = extensionStates.executed.some(searching => (
          searching.sha256 === sha256
        )) ? "<executed> " : "";

        return {
          "idRoot"  : `__settings-page__extensions-list-unrestricted-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : `${status}${metadata.name}`,
          "subtitle": metadata?.description,
          "disabled": !globalStates.extensions.allowUnrestrictedUntrusted,
          "onClick" : (): Promise<void> => (
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

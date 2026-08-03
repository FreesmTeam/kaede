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

import { computed } from "vue";

import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { SettingsRowCollectionType } from "@/types/ui/settings-row.type.ts";

export const ExtensionsSettingsRows: SettingsRowCollectionType = [
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-enabled",
    "icon"    : "i-lucide-blocks",
    "title"   : "Enable extensions",
    "subtitle": "Load trusted or community-made extensions",
    "onClick" : (): void => {
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
    "subtitle": "Allow untrusted extensions to run outside of the sandbox",
    "onClick" : (): void => {
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
      .map(({ id, metadata, sha256 }) => {
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-trusted-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} (unknown)`,
            "subtitle": metadata?.description,
          };
        }

        return {
          "idRoot"  : `__settings-page__extensions-list-trusted-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : metadata.name,
          "subtitle": metadata?.description,
          "onClick" : (): void => {
            globalStates.extensions.list[index].enabled =
              !globalStates.extensions.list[index].enabled;
          },
          "inner": {
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
    "title"   : "Community extensions (sandboxed)",
    "subtitle": "Enable or disable community extensions running in a sandbox",
    "inner"   : extensionStates
      .valid
      .filter(({ metadata }) => metadata.type === "sandbox")
      .map(({ id, metadata, sha256 }) => {
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-sandboxed-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} (unknown)`,
            "subtitle": metadata?.description,
          };
        }

        return {
          "idRoot"  : `__settings-page__extensions-list-sandboxed-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : metadata.name,
          "subtitle": metadata?.description,
          "onClick" : (): void => {
            globalStates.extensions.list[index].enabled =
              !globalStates.extensions.list[index].enabled;
          },
          "inner": {
            "kind" : "toggle",
            "value": globalStates.extensions.list[index].enabled,
          },
        };
      }),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-sandboxed-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No community (sandboxed) extensions loaded",
    },
  })),
  computed(() => ({
    "idRoot"  : "__settings-page__extensions-list-unrestricted",
    "icon"    : "i-lucide-triangle-alert",
    "title"   : "Community extensions (unrestricted)",
    "subtitle": "Enable or disable unsafe extensions",
    "inner"   : extensionStates
      .valid
      .filter(({ metadata, sha256 }) => (
        metadata.type === "unrestricted" &&
        !trustedExtensionHashes.value.has(sha256)
      ))
      .map(({ id, metadata, sha256 }) => {
        const index = globalStates.extensions.list.findIndex(searching => (
          searching.sha256 === sha256
        ));

        if (index === -1) {
          return {
            "idRoot"  : `__settings-page__extensions-list-unrestricted-entry-${id}`,
            "image"   : metadata.logo,
            "title"   : `${metadata.name} (unknown)`,
            "subtitle": metadata?.description,
          };
        }

        return {
          "idRoot"  : `__settings-page__extensions-list-unrestricted-entry-${id}`,
          "image"   : metadata.logo,
          "title"   : metadata.name,
          "subtitle": metadata?.description,
          "onClick" : (): void => {
            globalStates.extensions.list[index].enabled =
              !globalStates.extensions.list[index].enabled;
          },
          "inner": {
            "kind" : "toggle",
            "value": globalStates.extensions.list[index].enabled,
          },
        };
      }),
    "empty": {
      "idRoot"  : "__settings-page__extensions-list-unrestricted-empty",
      "icon"    : "__kaede-do-not-render",
      "subtitle": "No community (unrestricted) extensions loaded",
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

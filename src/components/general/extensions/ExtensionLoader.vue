<script setup lang="ts">
import { onMounted, ref } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

const knownExtensions = ref<Array<ExtensionMetadataType>>([]);
const unknownExtensions = ref<Array<ExtensionInfoType>>([]);

onMounted(async () => {
  log.debug(__PRE_BUNDLED_FILENAME__, "Getting all stored extensions");
  const extensions: Array<ExtensionInfoType> = await ExtensionsManager.readAllExtensions();

  log.debug(__PRE_BUNDLED_FILENAME__, "Getting extensions metadata file");
  const metadataList: Array<ExtensionMetadataType> = await ExtensionsManager.readAllMetadata();

  knownExtensions.value = metadataList;

  log.debug(__PRE_BUNDLED_FILENAME__, "Mapping valid and known extensions metadata");
  const metadataMap = new Map<string, {
    "index"      : number;
    "type"       : ExtensionMetadataType["type"];
    "permissions": ExtensionMetadataType["permissions"];
    "enabled"    : ExtensionMetadataType["enabled"];
  } | undefined>;

  for (const [index, { id, type, permissions, enabled }] of metadataList.entries()) {
    metadataMap.set(id, { index, type, permissions, enabled });
  }

  const toExecute: Record<
    ExtensionMetadataType["type"],
    Array<ExtensionInfoType & {
      "index"       : number;
      "permissions"?: Array<PermissionType>;
    }>
  > = { "sandbox": [], "unrestricted": [] };

  log.debug(__PRE_BUNDLED_FILENAME__, "Validating stored extensions against known extensions map");
  for (const extension of extensions) {
    const mappedMetadata = metadataMap.get(extension.id);

    if (mappedMetadata === undefined) {
      unknownExtensions.value.push(extension);

      continue;
    }

    if (mappedMetadata.enabled === true) {
      toExecute[mappedMetadata.type].push({
        ...extension,
        "index"      : mappedMetadata.index,
        "permissions": mappedMetadata?.permissions,
      });
    }
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Sorting extensions to execute based on their config list index",
  );
  toExecute.unrestricted.sort(
    ({ "index": indexBefore }, { "index": indexAfter }) => {
      return indexBefore - indexAfter;
    },
  );
  toExecute.sandbox.sort(
    ({ "index": indexBefore }, { "index": indexAfter }) => {
      return indexBefore - indexAfter;
    },
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled unrestricted extensions");
  for (const { id, code } of toExecute.unrestricted) {
    await ExtensionsManager.runInUnrestricted(id, code);
  }

  const hasSandboxedPlugins = toExecute.sandbox.length > 0;

  if (!hasSandboxedPlugins) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User does not have sandboxed plugins. Environment lockdown is not needed",
    );

    await ExtensionsManager.showWebviewWindow(
      globalStates?.misc?.showAfterExtensionsInitialization,
    );

    return;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Locking down the JavaScript environment");
  ExtensionsManager.lockdownEnvironment();
  log.info(__PRE_BUNDLED_FILENAME__, "The JavaScript environment was locked down");

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled sandboxed extensions");
  for (const { id, code, permissions } of toExecute.sandbox) {
    try {
      ExtensionsManager.runInSandbox({ id, permissions, code });
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `An error occurred while running the '${id}' extension:`,
        Errors.prettify(error),
      );
    }
  }

  await ExtensionsManager.showWebviewWindow(
    globalStates?.misc?.showAfterExtensionsInitialization,
  );
});

/*
 * Module Federation
 *
 * import { createInstance } from "@module-federation/enhanced/runtime";
 * import { defineAsyncComponent } from "vue";
 *
 * const mf = createInstance({
 *   "name"   : "mf_host",
 *   "remotes": [],
 * });
 *
 * mf.registerRemotes([
 *   {
 *     "name" : "remote1",
 *     "alias": "remote-1",
 *     "entry": "http://localhost:4173/bundle.js",
 *     // "entry": "https://unpkg.com/module-federation-rslib-provider@latest/dist/mf/mf-manifest.json",
 *   },
 * ]);
 *
 * const Huh = defineAsyncComponent(async () => {
 *   let element: { "MyButton": unknown } = { "MyButton": () => "<div></div>" };
 *
 *   try {
 *     element = await mf.loadRemote("remote1") as { "MyButton": unknown };
 *   } catch {
 *     // | console.log("Error loading Remote");
 *   }
 *
 *   return {
 *     "default": element.MyButton,
 *   };
 * });
 */
</script>

<template>
  <div id="__extension-loader__wrapper"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>

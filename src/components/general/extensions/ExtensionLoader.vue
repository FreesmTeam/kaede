<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import Globals from "@/lib/globals";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

const knownExtensions = ref<Array<ExtensionMetadataType>>([]);
const unknownExtensions = ref<Array<ExtensionInfoType>>([]);
const trustedContainer = ref<HTMLElement>();
const lifecycle = ExtensionsManager.createExtensionLifecycleController({
  "revokeExtensionGlobals": Globals.revokeExtensionGlobals,
});

onMounted(async () => {
  try {
    const container = trustedContainer.value;

    if (container === undefined) {
      throw new TypeError("The extension sandbox container is unavailable");
    }

    await lifecycle.initialize({
      "trustedContainer": container,
      "maxBounds"       : {
        "inlineSizePx": Math.max(1, window.innerWidth),
        "blockSizePx" : Math.max(1, window.innerHeight),
      },
      "onCatalog": catalog => {
        knownExtensions.value = [...catalog.metadata];
        unknownExtensions.value = [...catalog.unknownExtensions];
      },
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to initialize extensions:",
      Errors.prettify(error),
    );

    throw error;
  } finally {
    try {
      await ExtensionsManager.showWebviewWindow(
        globalStates?.misc?.showAfterExtensionsInitialization,
      );
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Failed to show the main webview after extension initialization:",
        Errors.prettify(error),
      );
    }
  }
});

onBeforeUnmount(() => {
  void lifecycle.disposeUntilClean().catch((error: unknown) => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to dispose extensions:",
      Errors.prettify(error),
    );
  });
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
  <div id="__extension-loader__wrapper" ref="trustedContainer"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import ExtensionAPI from "@/lib/extension-api";
import Extensions from "@/lib/extensions";
import { log } from "@/lib/logging/log.ts";
import Permissions from "@/lib/permissions";
import Txiki from "@/lib/txiki";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

GlobalObject.libs.ExtensionAPI = ExtensionAPI;
GlobalObject.libs.Extensions = Extensions;
GlobalObject.libs.Permissions = Permissions;
GlobalObject.libs.Txiki = Txiki;

onMounted(async () => {
  log.debug(__PRE_BUNDLED_FILENAME__, "Getting all extensions");
  const { valid, invalid } = await Extensions.readExtensions();

  extensionStates.valid = valid;
  extensionStates.invalid = invalid;

  const list = globalStates.extensions.list;
  const storage = new Map<string, boolean>(
    list.map(({ sha256, enabled }) => [sha256, enabled]),
  );

  // Add missing valid extensions
  for (const extension of valid) {
    if (!storage.has(extension.sha256)) {
      const label: string = `${extension.metadata.name} (${extension.id})`;

      list.push({ "sha256": extension.sha256, "enabled": false, label });
      storage.set(extension.sha256, false);
    }
  }

  const toExecute: Record<
    ExtensionType["metadata"]["type"],
    Array<ExtensionType>
  > = {
    "sandbox": valid.filter(({ sha256, metadata }) => (
      storage.get(sha256) &&
      metadata.type === "sandbox"
    )),
    "unrestricted": valid.filter(({ sha256, metadata }) => (
      storage.get(sha256) &&
      metadata.type === "unrestricted" && (
        trustedExtensionHashes.value.has(sha256) ||
        globalStates.extensions.allowUnrestrictedUntrusted
      )
    )),
  };

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled unrestricted extensions");
  for (const { id, code, metadata, sha256 } of toExecute.unrestricted) {
    const needsCleanRun: boolean = await Extensions.dirtyLifecycle(
      extensionStates.executed,
      { id, code, metadata, sha256 },
      true,
    );

    if (!needsCleanRun) {
      continue;
    }

    const api = await Extensions.runInUnrestricted(id, code, metadata, sha256);

    // If 'api' is missing, then the extension did not load
    if (!api) {
      const index = globalStates.extensions.list.findIndex(searching => (
        searching.sha256 === sha256
      ));

      // We need to show that the extension was not enabled
      globalStates.extensions.list[index].enabled = false;

      continue;
    }

    /*
     * 'needsCleanRun' simply represents if the extension is in 'extensionStates.executed',
     * so here we know that it is not in 'extensionStates.executed', yet
     */
    extensionStates.executed = [
      ...extensionStates.executed,
      { "extension": { id, code, metadata, sha256 }, api },
    ];
  }

  const hasSandboxedPlugins = toExecute.sandbox.length > 0;

  if (!hasSandboxedPlugins) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User does not have sandboxed plugins. Environment lockdown is not needed",
    );

    return await Extensions.showWebviewWindow();
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled sandboxed extensions");
  for (const { id, code, metadata, sha256 } of toExecute.sandbox) {
    const needsCleanRun: boolean = await Extensions.dirtyLifecycle(
      extensionStates.executed,
      { id, code, metadata, sha256 },
      true,
    );

    if (!needsCleanRun) {
      continue;
    }

    const permissions = metadata.permissions ?? [];

    const api = Extensions.runInSandbox({ id, permissions, code });

    // If 'api' is missing, then the extension did not load
    if (!api) {
      const index = globalStates.extensions.list.findIndex(searching => (
        searching.sha256 === sha256
      ));

      // We need to show that the extension was not enabled
      globalStates.extensions.list[index].enabled = false;

      continue;
    }

    /*
     * 'needsCleanRun' simply represents if the extension is in 'extensionStates.executed',
     * so here we know that it is not in 'extensionStates.executed', yet
     */
    extensionStates.executed = [
      ...extensionStates.executed,
      { "extension": { id, code, metadata, sha256 }, api },
    ];
  }

  await Extensions.showWebviewWindow();
});

onUnmounted(async () => {
  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Disabling ${extensionStates.executed.length} enabled extensions`,
  );
  for (const { extension, api } of extensionStates.executed) {
    try {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        `Disabling extension '${extension.id}' (sha256: ${extension.sha256})`,
      );
      const currentStatus: boolean = globalStates.extensions.list.find(searching => (
        searching.sha256 === extension.sha256
      ))?.enabled ?? false;

      if (currentStatus) {
        await api.disable();
      } else {
        log.warn(
          __PRE_BUNDLED_FILENAME__,
          `Extension '${extension.id}' seems to be already disabled`,
        );
      }
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while disabling extension '${extension.id}' (sha256: ${extension.sha256}):`,
        Errors.prettify(error),
      );
    }
  }
  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Disabled ${extensionStates.executed.length} enabled extensions`,
  );
});
</script>

<template>
  <div id="__extension-loader__wrapper"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>

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
import { extensionStates } from "@/states/extension.ts";
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
      list.push({ "sha256": extension.sha256, "enabled": false });
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
      metadata.type === "unrestricted"
    )),
  };

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled unrestricted extensions");
  for (const { id, code, metadata, sha256 } of toExecute.unrestricted) {
    const existing = extensionStates.executed.find(searching => searching.sha256 === sha256);

    if (existing !== undefined) {
      try {
        log.debug(
          __PRE_BUNDLED_FILENAME__,
          `Re-enabling extension '${id}' (sha256: ${sha256})`,
        );
        await existing.api.enable();
      } catch (error: unknown) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          `Error while re-enabling extension '${id}' (sha256: ${sha256})`,
          Errors.prettify(error),
        );
      }

      continue;
    }

    const result = await Extensions.runInUnrestricted(id, code, metadata, sha256);

    if (!result) {
      continue;
    }

    extensionStates.executed.push({ id, sha256, "api": result });
  }

  const hasSandboxedPlugins = toExecute.sandbox.length > 0;

  if (!hasSandboxedPlugins) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User does not have sandboxed plugins. Environment lockdown is not needed",
    );

    await Extensions.showWebviewWindow();

    return;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Locking down the JavaScript environment");
  Extensions.lockdownEnvironment();
  log.info(__PRE_BUNDLED_FILENAME__, "The JavaScript environment was locked down");

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled sandboxed extensions");
  for (const { id, code, metadata } of toExecute.sandbox) {
    const permissions = metadata.permissions ?? [];

    Extensions.runInSandbox({ id, permissions, code });
  }

  await Extensions.showWebviewWindow();
});

onUnmounted(async () => {
  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Disabling ${extensionStates.executed.length} enabled unrestricted extensions`,
  );
  for (const { id, sha256, api } of extensionStates.executed) {
    try {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        `Disabling extension '${id}' (sha256: ${sha256})`,
      );
      await api.disable();
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while disabling extensions '${id}' (sha256: ${sha256})`,
        Errors.prettify(error),
      );
    }
  }
  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Disabled ${extensionStates.executed.length} enabled unrestricted extensions`,
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

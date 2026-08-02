<script setup lang="ts">
import { onMounted } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import { GlobalObject } from "@/extendable/global-object.ts";
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
    list.map(({ id, enabled }) => [id, enabled]),
  );

  // Add missing valid extensions
  for (const extension of valid) {
    if (!storage.has(extension.id)) {
      list.push({ "id": extension.id, "enabled": false });
      storage.set(extension.id, false);
    }
  }

  const toExecute: Record<
    ExtensionType["metadata"]["type"],
    Array<ExtensionType>
  > = {
    "sandbox": valid.filter(({ id, metadata }) => (
      storage.get(id) &&
      metadata.type === "sandbox"
    )),
    "unrestricted": valid.filter(({ id, metadata }) => (
      storage.get(id) &&
      metadata.type === "unrestricted"
    )),
  };

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled unrestricted extensions");
  for (const { id, code, metadata, sha256 } of toExecute.unrestricted) {
    const result = await Extensions.runInUnrestricted(id, code, metadata, sha256);

    if (!result) {
      continue;
    }

    extensionStates.executed.push(result);
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
</script>

<template>
  <div id="__extension-loader__wrapper"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>

<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { ref, watchEffect } from "vue";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { Host } from "@/lib/capability-broker";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

const syncing = ref<boolean>(false);

async function handleConfigSync(): Promise<void> {
  const t1 = performance.now();

  syncing.value = true;

  log.debug(__PRE_BUNDLED_FILENAME__, "Getting current global states");
  const currentGlobalStatesDetached: ConfigType & Partial<GlobalStatesType> = {
    // Spread the global states to re-create one-level deep properties
    ...globalStates,
  };
  const configPath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Files.Config,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Getting current user config");
  const config = await Configs.getSafe();

  // Remove all non-config properties
  delete currentGlobalStatesDetached.translations;
  delete currentGlobalStatesDetached.sidebarItems;
  delete currentGlobalStatesDetached.contextMenuItems;
  delete currentGlobalStatesDetached.pages;

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Creating a 'ConfigType' typed object with the global states contents",
  );
  const configOnlyGlobalStates: ConfigType = {
    // Spread the global states since there might be additional properties by extensions
    ...currentGlobalStatesDetached,
    // Arrange these properties in a way that the config itself arranges them
    "development": currentGlobalStatesDetached.development,
    "extensions" : currentGlobalStatesDetached.extensions,
    "layout"     : currentGlobalStatesDetached.layout,
    "logs"       : {
      ...currentGlobalStatesDetached.logs,
      "show": false,
    },
    "minecraft": currentGlobalStatesDetached.minecraft,
    "misc"     : currentGlobalStatesDetached.misc,
  };
  const stringyConfig = JSON.stringify(config);
  const stringyGlobalStates = JSON.stringify(configOnlyGlobalStates);

  if (stringyConfig === stringyGlobalStates) {
    log.info(__PRE_BUNDLED_FILENAME__, "Seems like config didn't change. No need for config sync");
    syncing.value = false;

    return;
  }

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Updating the config file with new values");
    await Host.files.writeText(
      configPath,
      JSON.stringify(configOnlyGlobalStates, null, 2),
    );
  } catch (error: unknown) {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to sync the config file:", Errors.prettify(error));
  }

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Config file successfully synced in:",
    (performance.now() - t1).toFixed(1),
    "ms",
  );
  syncing.value = false;
}

// Trigger config sync every 30 seconds
const { pause, resume } = useIntervalFn(handleConfigSync, 30_000);

// Make the config sync function accessible to everyone
GlobalInternals.syncConfig = handleConfigSync;

// Use auto config sync only if user has enabled it
watchEffect(() => {
  if (globalStates?.misc?.autoConfigSync) {
    resume();

    return;
  }

  pause();
});
</script>

<template>
  <div
    id="__config-syncer__wrapper"
    :class="[
      syncing ? 'opacity-20' : 'opacity-0 transition-[opacity]',
      'fixed bottom-6 left-6 pointer-events-none z-1500',
    ]"
  >
    <div
      id="__config-syncer__loader-icon"
      class="i-lucide-cog size-8"
    ></div>
  </div>
</template>

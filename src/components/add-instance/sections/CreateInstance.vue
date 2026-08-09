<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { computed, inject, markRaw, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { LaunchStatesContextKey } from "@/constants/application.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const { styles } = useConfigColors();

const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);

const pending = ref<boolean>(false);

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(
      globalStates.pages?.["add-instance"]?.instance,
      globalStates.minecraft,
    )
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const imported = computed(
  (): GlobalStatesType["pages"]["add-instance"]["importedModpack"] => (
    globalStates?.pages?.["add-instance"]?.importedModpack
  ),
);

/**
 * Modpack downloads report into the same statuses the launch progress
 * widget already renders, so the import is visible while it runs
 */
function trackDownloads(instanceId: string): LauncherStatusesType {
  const statuses: LauncherStatusesType = {
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current": markRaw(new Map<string, [number, number]>),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };

  if (instanceStatuses !== undefined) {
    instanceStatuses[instanceId] = statuses;
  }

  return statuses;
}

async function handleCreate(): Promise<void> {
  const archive = imported.value;

  const instanceId: string | undefined = Instances.create(
    currentInstance.value,
    currentPatch.value,
  );

  // 'create' already told the user why nothing happened
  if (instanceId === undefined || !archive) {
    return;
  }

  globalStates.pages["add-instance"].importedModpack = undefined;
  pending.value = true;

  const statuses: LauncherStatusesType = trackDownloads(instanceId);

  try {
    await Modrinth.installMrpack({
      "archivePath": archive.path,
      instanceId,
      statuses,
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not install '${archive.path}' into '${instanceId}':`,
      Errors.prettify(error),
    );
  } finally {
    statuses.launching = 0;
    pending.value = false;
  }
}
</script>

<template>
  <div
    id="__add-instance-page__create-instance-wrapper"
    class="w-fit flex flex-nowrap gap-2 rounded-md p-2"
  >
    <button
      id="__add-instance-page__create-instance-button"
      class="relative rounded-md px-2 py-1 transition-[opacity] bg-[theme(colors.neutral.100/.1)] disabled:opacity-70"
      :disabled="pending"
      @click="handleCreate"
    >
      {{ pending ? "Installing the modpack..." : "Create an Instance" }}
      <MaterialRipple :disabled="pending" />
    </button>
    <div
      id="__add-instance-page__create-instance-type-display"
      class="py-1 pr-2"
      :style="styles.widgetSecondary"
    >
      with {{ PrettyPatchLabels[currentPatch] }}
      <span
        v-if="
          globalStates.pages['add-instance'].importedModpack &&
          globalStates.pages['add-instance'].importedModpack.loader === currentPatch
        "
        id="__add-instance-page__create-instance-type-display-imported"
        :style="{ 'color': styles.widget.color }"
      >
        ({{ globalStates.pages["add-instance"].importedModpack.name }})
      </span>
    </div>
  </div>
</template>

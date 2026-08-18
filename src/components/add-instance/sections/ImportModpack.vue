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
import { open } from "@tauri-apps/plugin-dialog";
import { computed, ref } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { InstanceCreationSections } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

const { styles } = useConfigColors();

// 'string' is for errors
const status = ref<"pending" | "done" | string>("done");

const imported = computed(
  (): GlobalStatesType["pages"]["add-instance"]["importedModpack"] => (
    globalStates?.pages?.["add-instance"]?.importedModpack
  ),
);

const displayedName = computed((): string => {
  if (!imported.value) {
    return "";
  }

  return imported.value.name
    ?? imported.value.path.split(/[/\\]/).pop()
    ?? imported.value.path;
});

async function handleImport(): Promise<void> {
  status.value = "pending";

  const selectedPath: string | null = await open({
    "multiple" : false,
    "directory": false,
    "title"    : "Select a modpack archive",
    "filters"  : [{ "name": "Modpack", "extensions": ["mrpack", "zip"] }],
  });

  if (!selectedPath) {
    status.value = "done";

    return;
  }

  try {
    const manifest: MrpackManifestType | undefined =
      await Modrinth.peekMrpack(selectedPath);

    Modrinth.applyManifest({ manifest, "path": selectedPath });
    globalStates.pages["add-instance"]?.select?.(InstanceCreationSections[0]);

    status.value = "done";
  } catch (error: unknown) {
    status.value = Errors.prettify(error);
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not read '${selectedPath}':`,
      status.value,
    );
  }
}
</script>

<template>
  <div
    id="__add-instance-page__instance-import"
    class="flex flex-wrap items-center gap-2 rounded-md"
  >
    <CustomButton
      id-root="__add-instance-page__instance-import-button"
      icon="i-lucide-file-archive"
      class="w-full"
      :label="status === 'pending' ? 'Loading...' : 'Import a modpack'"
      tooltip="Select a Modrinth modpack archive"
      :disabled="status === 'pending'"
      :on-click="handleImport"
    />
    <div
      v-if="imported"
      id="__add-instance-page__instance-import-selected"
      class="min-w-0 flex flex-1 flex-nowrap items-center gap-2 rounded-md pl-2 pr-1 leading-none"
      :title="imported.path"
    >
      <span
        id="__add-instance-page__instance-import-selected-icon"
        :class="[
          imported.name === undefined ? 'i-lucide-file-question' : 'i-lucide-package',
          'block size-4 shrink-0',
        ]"
      ></span>
      <span
        id="__add-instance-page__instance-import-selected-name"
        class="line-clamp-1 h-8 flex flex-1 items-center text-ellipsis"
      >
        {{ displayedName }}
      </span>
      <button
        id="__add-instance-page__instance-import-selected-reset"
        class="relative grid size-6 shrink-0 place-items-center rounded-md hover:bg-[theme(colors.neutral.100/.05)]"
        title="Remove the imported modpack"
        @click="Instances.resetPageStates"
      >
        <span
          id="__add-instance-page__instance-import-selected-reset-icon"
          class="i-lucide-x block size-4"
        ></span>
        <MaterialRipple />
      </button>
    </div>
    <p
      v-if="imported && imported.name === undefined"
      id="__add-instance-page__instance-import-plain-zip"
      class="w-full px-1 text-sm"
      :style="styles.widgetSecondary"
    >
      No Modrinth manifest inside
    </p>
    <p
      v-if="status !== 'done' && status !== 'pending'"
      id="__add-instance-page__instance-import-error"
      class="w-full px-1 text-sm text-red-300"
    >
      Could not read the archive: {{ status }}
    </p>
  </div>
</template>

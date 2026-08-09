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
import { computed } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(
      globalStates.pages?.["add-instance"]?.instance,
      globalStates.minecraft,
    )
  ),
);

function handleNameChange(input: string): void {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not change an instance name since the instance is undefined",
    );
  }

  globalStates.pages["add-instance"].instance = {
    ...currentInstance.value,
    "name": input,
  };
}
</script>

<template>
  <div
    id="__add-instance-page__instance-name"
    class="flex flex-nowrap gap-2 rounded-md p-2"
  >
    <CustomInput
      icon="i-lucide-grid-2x2"
      placeholder="Instance Name"
      id-root="__add-instance-page__instance-name"
      tooltip="Instance name"
      :debounce-time="300"
      :default-value="currentInstance?.name"
      :on-input="handleNameChange"
      :on-blur="handleNameChange"
      :class-names="{ 'wrapper': 'h-8 flex-1 w-fit sm:w-fit' }"
    />
    <button
      v-if="globalStates.pages['add-instance'].importedModpack"
      id="__add-instance-page__instance-name-import-reset"
      class="relative grid size-8 shrink-0 place-items-center rounded-md bg-[theme(colors.neutral.100/.1)]"
      title="Remove the imported modpack"
      @click="Instances.resetPageStates"
    >
      <span
        id="__add-instance-page__instance-name-import-reset-icon"
        class="i-lucide-package-x block size-4"
      ></span>
      <MaterialRipple />
    </button>
  </div>
</template>

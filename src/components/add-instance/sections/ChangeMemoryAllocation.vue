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
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const currentMemoryAllocation = computed((): {
  "max": number;
  "min": number;
} => {
  const jvmArguments: Array<string> = currentInstance?.value?.add?.jvmArguments ?? [];
  const results = {
    "max": 6144,
    "min": 4096,
  };

  for (const jvmArgument of jvmArguments) {
    if (jvmArgument.startsWith("-Xms")) {
      results.min = Number(jvmArgument.slice(4, -1));
    }

    if (jvmArgument.startsWith("-Xmx")) {
      results.max = Number(jvmArgument.slice(4, -1));
    }
  }

  return results;
});

function handleMemoryAllocation(value: string, type: "min" | "max"): void {
  if (!currentInstance.value) {
    return;
  }

  const currentJvmArguments: Array<string> = currentInstance.value.add.jvmArguments
    // Remove any existing memory allocation flags
    .filter(jvmArgument => !jvmArgument.startsWith("-Xms") && !jvmArgument.startsWith("-Xmx"));

  if (type === "max") {
    currentJvmArguments
      .unshift(`-Xms${currentMemoryAllocation.value.min}m`, `-Xmx${value}m`);
  } else {
    currentJvmArguments
      .unshift(`-Xms${value}m`, `-Xmx${currentMemoryAllocation.value.max}m`);
  }

  globalStates.pages["add-instance"].instance = {
    ...currentInstance.value,
    "add": {
      ...currentInstance.value.add,
      "jvmArguments": currentJvmArguments,
    },
  };
}
</script>

<template>
  <div
    id="__add-instance-page__instance-other-memory-title"
    class="relative rounded-md p-2"
  >
    <p
      id="__add-instance-page__instance-other-memory-title-label"
      class="h-8 flex items-center pl-2 text-neutral-400 leading-none"
    >
      Memory allocation
    </p>
  </div>
  <div
    id="__add-instance-page__instance-other-min-memory"
    class="relative rounded-md p-2"
  >
    <div
      id="__add-instance-page__instance-other-min-memory-unit"
      class="pointer-events-none absolute right-4 top-[50%] z-10 translate-y-[-50%] text-sm text-neutral-400"
    >
      MB
    </div>
    <CustomInput
      icon="i-lucide-chevron-down"
      placeholder="Minimum amount of RAM to allocate, in megabytes (MB)"
      id-root="__add-instance-page__instance-other-min-memory"
      type="number"
      tooltip="Minimum amount of RAM to allocate, in megabytes (MB)"
      :debounce-time="300"
      :default-value="currentMemoryAllocation.min"
      :on-input="value => handleMemoryAllocation(value, 'min')"
      :on-blur="value => handleMemoryAllocation(value, 'min')"
      :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
    />
  </div>
  <div
    id="__add-instance-page__instance-other-max-memory"
    class="relative rounded-md p-2"
  >
    <div
      id="__add-instance-page__instance-other-max-memory-unit"
      class="pointer-events-none absolute right-4 top-[50%] z-10 translate-y-[-50%] text-sm text-neutral-400"
    >
      MB
    </div>
    <CustomInput
      icon="i-lucide-chevron-up"
      placeholder="Maximum amount of RAM to allocate, in megabytes (MB)"
      id-root="__add-instance-page__instance-other-max-memory"
      type="number"
      tooltip="Maximum amount of RAM to allocate, in megabytes (MB)"
      :debounce-time="300"
      :default-value="currentMemoryAllocation.max"
      :on-input="value => handleMemoryAllocation(value, 'max')"
      :on-blur="value => handleMemoryAllocation(value, 'max')"
      :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
    />
  </div>
</template>

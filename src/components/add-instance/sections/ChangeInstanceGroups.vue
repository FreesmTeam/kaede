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

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances/index.js";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.js";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);

function handleGroup(group: string): void {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not change instance groups since the instance is undefined",
    );
  }

  const currentGroups: Set<string> = new Set(currentInstance.value.groups);

  if (currentGroups.has(group)) {
    currentGroups.delete(group);
  } else {
    currentGroups.add(group);
  }

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "groups": [...currentGroups],
    },
  });
}
</script>

<template>
  <div
    v-if="currentInstance?.groups"
    id="__add-instance-page__instance-groups"
    class="flex flex-nowrap gap-2 overflow-x-auto rounded-md p-2"
  >
    <template v-if="['Group 1', 'Group 2', 'Hiii'].length > 0">
      <button
        v-for="group in ['Group 1', 'Group 2', 'Hiii']"
        :id="`__add-instance-page__instance-group-${group}`"
        :key="group"
        @click="() => handleGroup(group)"
        :class="[
          '__add-instance-page__instance-group',
          'shrink-0 relative rounded-md px-2 py-1 transition-[background-color,color]',
          currentInstance?.groups?.includes?.(group)
            ? 'bg-[theme(colors.neutral.100/.25)]'
            : 'bg-[theme(colors.neutral.100/.1)] text-neutral-400',
        ]"
      >
        <span
          :id="`__add-instance-page__instance-group-${group}-label`"
        >
          {{ group }}
        </span>
        <MaterialRipple />
      </button>
    </template>
    <template v-else>
      <p
        id="__add-instance-page__no-groups-text"
        class="h-8 flex items-center pl-2 text-neutral-400 leading-none"
      >
        No groups to select...
      </p>
    </template>
  </div>
</template>

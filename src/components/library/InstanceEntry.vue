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

import Image from "@/components/general/base/Image.vue";
import { globalStates } from "@/states/global.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

const { idRoot, instanceId, instance } = defineProps<{
  "idRoot"    : string;
  "instanceId": string;
  "instance"  : InstanceStateType;
}>();

const selected = computed((): boolean => {
  return globalStates.pages.library.selected === instanceId;
});

function handleLeftClick(): void {
  globalStates.pages.library.selected = instanceId;
}
function handleDoubleClick(event: MouseEvent): void {
  console.log(event);
}
function handleRightClick(event: MouseEvent): void {
  console.log(event);
}
</script>

<template>
  <button
    :id="`${idRoot}-button`"
    class="flex flex-col gap-2"
    @click="handleLeftClick"
    @dblclick="handleDoubleClick"
    @contextmenu.prevent.stop="handleRightClick"
  >
    <Image
      class-names="shrink-0 object-cover size-16"
      :id="`${idRoot}-button-icon`"
      :src="instance.icon"
      :alt="`${instance.name}'s icon`"
    />
    {{ selected }}
  </button>
</template>
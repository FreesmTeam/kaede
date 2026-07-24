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

import General from "@/lib/general";
import { globalStates } from "@/states/global.ts";

const { idRoot, title, subtitle } = defineProps<{
  "idRoot"   : string;
  "title"    : string;
  "subtitle"?: string;
}>();

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);
</script>

<template>
  <div
    :id="`${idRoot}-wrapper`"
    class="relative w-full flex flex-nowrap items-center justify-between gap-4 rounded-md p-2"
    :style="cardStyles"
  >
    <div
      :id="`${idRoot}-information`"
      class="flex flex-col gap-1 pl-2"
    >
      <span
        :id="`${idRoot}-title`"
        class="leading-none"
      >
        {{ title }}
      </span>
      <span
        v-if="subtitle"
        :id="`${idRoot}-subtitle`"
        class="text-sm text-neutral-400 leading-none"
      >
        {{ subtitle }}
      </span>
    </div>
    <div
      :id="`${idRoot}-control`"
      class="flex shrink-0 flex-nowrap items-center gap-2"
    >
      <slot />
    </div>
  </div>
</template>

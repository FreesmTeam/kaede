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
import { globalStates } from "@/states/global.ts";

const { idRoot, icon, title, subtitle } = defineProps<{
  "idRoot"   : string;
  "title"    : string;
  "icon"    ?: string;
  "subtitle"?: string;
}>();
</script>

<template>
  <div
    :id="`${idRoot}-wrapper`"
    class="relative w-full flex flex-nowrap items-center gap-4 rounded-md p-2"
  >
    <div :id="`${idRoot}-icon-wrapper`" class="grid place-items-center size-8 shrink-0">
      <div :id="`${idRoot}-icon`" :class="[icon, 'size-6']"></div>
    </div>
    <div
      :id="`${idRoot}-information`"
      class="w-full flex flex-col gap-1"
    >
      <span
        :id="`${idRoot}-title`"
        class="leading-none"
        :style="{ 'color': globalStates.ui.text.mainColor ?? '#FFFFFF' }"
      >
        {{ title }}
      </span>
      <span
        v-if="subtitle"
        :id="`${idRoot}-subtitle`"
        class="text-sm text-neutral-400 leading-none"
        :style="{ 'color': globalStates.ui.text.secondaryColor ?? '#A3A3A3' }"
      >
        {{ subtitle }}
      </span>
    </div>
    <div
      :id="`${idRoot}-control`"
      class="flex shrink-0 flex-nowrap items-center gap-2 rounded-md"
    >
      <slot />
    </div>
  </div>
</template>

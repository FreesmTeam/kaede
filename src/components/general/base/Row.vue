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
import Image from "@/components/general/base/Image.vue";
import { globalStates } from "@/states/global.ts";

const { idRoot, separate, image, icon, title, subtitle } = defineProps<{
  "idRoot"   : string;
  "separate"?: string;
  "title"   ?: string;
  "image"   ?: string;
  "icon"    ?: string;
  "subtitle"?: string;
}>();
</script>

<template>
  <div
    v-if="separate !== undefined"
    :id="idRoot"
  >
    <div
      :id="`${idRoot}-label`"
      class="pl-14 text-sm leading-none"
      :style="{ 'color': globalStates.ui.widget.secondaryColor || '#A3A3A3' }"
    >
      {{ separate }}
    </div>
  </div>
  <div
    v-else
    :id="`${idRoot}-wrapper`"
    class="relative w-full flex flex-nowrap items-center gap-4 rounded-md p-2"
  >
    <div v-if="image" :id="`${idRoot}-image-wrapper`" class="grid size-8 shrink-0 place-items-center">
      <Image
        :id="`${idRoot}-image`"
        :src="image"
        :alt="`Image for the row '${title}'`"
        class-names="size-8 object-cover rounded-md"
      />
    </div>
    <div v-else-if="icon !== '__kaede-do-not-render'" :id="`${idRoot}-icon-wrapper`" class="grid size-8 shrink-0 place-items-center">
      <div :id="`${idRoot}-icon`" :class="[icon || 'i-lucide-toy-brick', 'size-6']"></div>
    </div>
    <div v-else :id="`${idRoot}-no-icon-padding`" class="size-8 shrink-0"></div>
    <div
      :id="`${idRoot}-information`"
      class="w-full flex flex-col gap-1"
    >
      <span
        v-if="title"
        :id="`${idRoot}-title`"
        class="break-all leading-none"
        :style="{ 'color': globalStates.ui.widget.textColor || '#FFFFFF' }"
      >
        {{ title }}
      </span>
      <span
        v-if="subtitle"
        :id="`${idRoot}-subtitle`"
        class="break-all text-sm leading-none"
        :style="{ 'color': globalStates.ui.widget.secondaryColor || '#A3A3A3' }"
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

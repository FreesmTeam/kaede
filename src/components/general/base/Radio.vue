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
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";

const { id, value, onSelect, ripples = true } = defineProps<{
  "id"       : string;
  "value"    : boolean;
  "onSelect"?: (event: MouseEvent) => void;
  "ripples" ?: boolean;
}>();

const { styles } = useConfigColors();
</script>

<template>
  <button
    :id="id"
    role="radio"
    :aria-checked="value"
    @click="onSelect"
    :disabled="value"
    class="group relative z-10 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color] bg-[theme(colors.neutral.100/.1)] disabled:bg-white"
  >
    <span
      :id="`${id}-thumb`"
      class="block size-2 rounded-full transition-[background-color]"
      :style="{ 'background-color': value ? 'black' : styles.widget.color }"
    ></span>
    <MaterialRipple :disabled="!ripples" />
  </button>
</template>
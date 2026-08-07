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

const { id, value, onToggle, ripples = true } = defineProps<{
  "id"       : string;
  "value"    : boolean;
  "onToggle"?: (value: boolean) => void;
  "ripples" ?: boolean;
}>();

const { styles } = useConfigColors();
</script>

<template>
  <button
    :id="id"
    role="switch"
    :aria-checked="value"
    @click="() => onToggle?.(!value)"
    class="relative z-10 h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[theme(colors.neutral.100/.1)]"
  >
    <span
      :id="`${id}-thumb`"
      :class="[
        value
          ? 'translate-x-6'
          : 'translate-x-1 opacity-50',
        'block size-4 rounded-full transition-[transform,opacity,background-color] duration-150',
      ]"
      :style="{
        'background-color': value ? styles.widget.color : styles.widgetSecondary.color,
      }"
    ></span>
    <MaterialRipple :disabled="!ripples" />
  </button>
</template>

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

const { id, value, onToggle, ripples = true, transitionless } = defineProps<{
  "id"             : string;
  "value"          : boolean;
  "onToggle"      ?: (value: boolean) => void;
  "ripples"       ?: boolean;
  "transitionless"?: boolean;
}>();

const { styles } = useConfigColors();
</script>

<template>
  <button
    :id="id"
    role="checkbox"
    :aria-checked="value"
    @click="() => onToggle?.(!value)"
    :class="[
      value ? 'bg-white' : 'bg-[theme(colors.neutral.100/.1)]',
      transitionless ? '' : 'transition-[background-color]',
      'group relative z-10 grid size-6 shrink-0 rounded-md cursor-pointer place-items-center',
    ]"
  >
    <span
      :id="`${id}-thumb`"
      :class="[
        value ? 'opacity-100' : 'opacity-0',
        transitionless ? '' : 'transition-[background-color,opacity]',
        'i-lucide-check block size-',
      ]"
      :style="{ 'background-color': value ? 'black' : styles.widget.color }"
    ></span>
    <MaterialRipple :disabled="!ripples" />
  </button>
</template>

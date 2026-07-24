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

const { id, modelValue, onToggle } = defineProps<{
  "id"        : string;
  "modelValue": boolean;
  "onToggle"  : (value: boolean) => void;
}>();
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    @click="() => onToggle(!modelValue)"
    :class="[
      modelValue ? 'bg-white' : 'bg-[theme(colors.neutral.100/.1)]',
      'relative h-6 w-11 shrink-0 cursor-pointer rounded-full',
      'transition-[background-color] duration-150',
    ]"
  >
    <span
      :id="`${id}-thumb`"
      :class="[
        modelValue
          ? 'left-6 bg-neutral-900'
          : 'left-1 bg-neutral-400',
        'absolute top-1 size-4 rounded-full transition-[left] duration-150',
      ]"
    ></span>
    <MaterialRipple />
  </button>
</template>

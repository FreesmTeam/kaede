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
import { onClickOutside } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const {
  idRoot,
  options,
  value,
  onSelect,
  tooltip,
  classNames,
} = defineProps<{
  "idRoot"       : string;
  "options"      : Array<string>;
  "value"       ?: string;
  "onSelect"    ?: (value: string) => void;
  "tooltip"     ?: string;
  "classNames"  ?: {
    "wrapper" ?: string;
    "button"  ?: string;
    "icon"    ?: string;
    "display" ?: string;
    "dropdown"?: string;
  };
}>();

const target = useTemplateRef("target");

const opened = ref<boolean>(false);

function handleDropdown(enabled?: boolean): void {
  opened.value = enabled ?? !opened.value;
}
function handleSelect(value: string): void {
  onSelect?.(value);
  handleDropdown(false);
}

/*
 * Assuming that 'idRoot' and '-control' won't change...
 *
 * Example: '__settings-page__ui-background-color-color'
 */
const parts: Array<string> = idRoot.split("-");

// '__settings-page__ui-background-color'
parts.pop();
// 'Row.vue' in the container of '<slot />' passes '${idRoot}-control'
parts.push("control");

const parentId: string = parts.join("-");

defineExpose({
  "open": (): void => handleDropdown(),
});

onClickOutside(target, event => {
  if (event.target instanceof HTMLElement) {
    const target = event.target;

    // If the user clicked a row
    if (target.parentElement?.id === parentId) {
      return;
    }
  }

  handleDropdown(false);
});
</script>

<template>
  <div
    ref="target"
    :id="`${idRoot}-wrapper`"
    :class="[classNames?.wrapper, 'relative shrink-0 w-28 sm:w-40']"
    :title="tooltip"
  >
    <button
      aria-haspopup="menu"
      :aria-expanded="opened"
      @click="() => handleDropdown()"
      :id="`${idRoot}-button`"
      :class="[
        classNames?.button,
        opened ? 'text-white' : 'text-neutral-400',
        'h-8 w-full flex flex-nowrap items-center gap-2 rounded-md',
        'relative overflow-x-hidden pl-2 bg-[theme(colors.neutral.100/.1)] outline-none',
      ]"
    >
      <span
        :id="`${idRoot}-chevron`"
        :class="[
          opened ? 'rotate-180' : '',
          'i-lucide-chevron-down',
          'shrink-0 block pointer-events-none size-4 transition-[color,transform]',
        ]"
      ></span>
      <span :id="`${idRoot}-label`" class="line-clamp-1 text-ellipsis text-start transition-[color]">
        {{ value }}
      </span>
      <MaterialRipple />
    </button>

    <Transition name="slide-up">
      <div
        v-if="opened"
        :id="`${idRoot}-dropdown-wrapper`"
        class="absolute left-0 right-0 top-10 z-50 flex flex-col rounded-md bg-neutral-900 py-1"
      >
        <button
          v-for="option in options"
          :id="`${idRoot}-dropdown-item-${option}`"
          :key="option"
          @click="() => handleSelect(option)"
          class="relative px-4 py-1 text-start text-neutral-300 active:bg-[theme(colors.white/.1)] hover:bg-[theme(colors.white/.05)]"
        >
          {{ option }}
        </button>
      </div>
    </Transition>
  </div>
</template>

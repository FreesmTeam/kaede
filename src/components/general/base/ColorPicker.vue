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
import { computed, ref, useTemplateRef } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { globalStates } from "@/states/global.ts";

const {
  idRoot,
  value,
  onColor,
  tooltip,
  defaultColor = "#000000",
  classNames,
} = defineProps<{
  "idRoot"       : string;
  "value"       ?: string | null;
  "onColor"     ?: (value: string) => void;
  "tooltip"     ?: string;
  "defaultColor"?: string;
  "classNames"  ?: {
    "wrapper" ?: string;
    "button"  ?: string;
    "swatch"  ?: string;
    "label"   ?: string;
  };
}>();

const container = useTemplateRef("container");
const nativeInput = useTemplateRef("nativeInput");

const opened = ref<boolean>(false);

const backgroundColor = computed((): string => {
  const color: string = value || defaultColor;

  // HEX
  if (color.startsWith("#")) {
    return color;
  }

  // RGB
  return `rgba(${color.split(" ").join(",")})`;
});

function handleDropdown(enabled?: boolean): void {
  opened.value = enabled ?? !opened.value;
}

function handleHexInput(event: Event): void {
  const target = event?.target as HTMLInputElement;
  const targetValue = target?.value ?? "";

  onColor?.(targetValue);
}

defineExpose({
  "open": (): void => {
    if (globalStates.development.useNativeColorPicker) {
      /*
       * Since the 'open' function is called within a button,
       * this manual input open should succeed even in Firefox
       */
      return nativeInput.value?.click?.();
    }

    handleDropdown();
  },
});

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

onClickOutside(container, event => {
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
  <label
    v-if="globalStates.development.useNativeColorPicker"
    :id="`${idRoot}-wrapper`"
    :class="[
      classNames?.wrapper,
      'shrink-0 relative z-10 !w-40 flex flex-nowrap items-center',
      'cursor-pointer gap-2 rounded-md p-2 bg-[theme(colors.neutral.100/.1)]',
    ]"
    :title="tooltip"
  >
    <span
      :id="`${idRoot}-swatch`"
      :class="[classNames?.swatch, 'size-4 shrink-0 rounded-full']"
      :style="{ 'background-color': backgroundColor }"
    ></span>
    <span
      :id="`${idRoot}-label`"
      :class="[classNames?.label, 'line-clamp-1 text-ellipsis text-sm text-neutral-400']"
    >
      {{ value || "Default" }}
    </span>
    <input
      ref="nativeInput"
      type="color"
      :id="`${idRoot}-native-input`"
      class="absolute bottom-0 left-0 right-0 top-0 size-full cursor-pointer opacity-0"
      :value="value ?? defaultColor"
      @input="handleHexInput"
    />
    <MaterialRipple />
  </label>

  <!-- Built-in color picker -->
  <div
    v-else
    ref="container"
    :id="`${idRoot}-wrapper`"
    :class="[classNames?.wrapper, 'relative shrink-0 !w-40']"
    :title="tooltip"
  >
    <button
      aria-haspopup="dialog"
      :aria-expanded="opened"
      @click="() => handleDropdown()"
      :id="`${idRoot}-button`"
      :class="[
        classNames?.button,
        opened ? 'text-white' : 'text-neutral-400',
        'h-8 w-full flex flex-nowrap items-center gap-2 rounded-md',
        'relative overflow-x-hidden px-2 bg-[theme(colors.neutral.100/.1)] outline-none',
      ]"
    >
      <span
        :id="`${idRoot}-swatch`"
        class="size-4 shrink-0 rounded-full"
        :style="{ 'background-color': backgroundColor }"
      ></span>
      <span :id="`${idRoot}-label`" class="line-clamp-1 text-ellipsis text-start text-sm transition-[color]">
        {{ value || "Default" }}
      </span>
      <MaterialRipple />
    </button>

    <Transition name="slide-up">
      <div
        v-if="opened"
        :id="`${idRoot}-dropdown-wrapper`"
        class="absolute left-0 top-10 z-100 w-full flex flex-col cursor-default rounded-md bg-black"
      >
        <div
          :id="`${idRoot}-preview`"
          class="h-32 w-full flex items-end rounded-md p-2"
          :style="{ 'background-color': backgroundColor }"
        >
          <input
            autofocus
            autocomplete="off"
            spellcheck="false"
            :id="`${idRoot}-hex-input`"
            class="h-8 w-full rounded-md bg-neutral-800 px-2 py-1 text-sm text-neutral-300 outline-none focus:outline-none placeholder-neutral-500"
            placeholder="#RRGGBBAA"
            :value="value ?? ''"
            @input="handleHexInput"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

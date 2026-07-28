<script setup lang="ts">
import { useDebounceFn, useEventListener } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const {
  icon,
  placeholder,
  debounceTime,
  idRoot,
  defaultValue,
  listenToEvents,
  focusOnKeyF,
  blurOnEscape = true,
  onInput,
  onKeyDown,
  onEscape,
  onKeyboardEvent,
  onBlur,
  classNames,
  type,
  tooltip,
} = defineProps<{
  "icon"            : string;
  "placeholder"     : string;
  "debounceTime"    : number;
  "idRoot"          : string;
  "defaultValue"   ?: string | number;
  "listenToEvents" ?: boolean;
  "focusOnKeyF"    ?: boolean;
  "blurOnEscape"   ?: boolean;
  "onInput"        ?: (value: string) => void;
  "onKeyDown"      ?: (event: KeyboardEvent) => void;
  "onEscape"       ?: () => void;
  "onKeyboardEvent"?: (event: KeyboardEvent) => void;
  "onBlur"         ?: (value: string) => void;
  "classNames"     ?: {
    "wrapper" : string;
    "icon"   ?: string;
    "input"  ?: string;
  };
  "type"   ?: "text" | "number";
  "tooltip"?: string;
}>();

const target = useTemplateRef("target");

const focused = ref<boolean>(false);

function unFocus(event: Event): void {
  const target = event?.target as HTMLInputElement;

  target?.blur?.();

  const value: string = target?.value ?? "";

  onBlur?.(value);

  focused.value = false;
}

const handleInput = useDebounceFn((event: Event): void => {
  const target = event?.target as HTMLInputElement;
  const targetValue = target?.value ?? "";

  onInput?.(targetValue);
}, debounceTime);

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && blurOnEscape) {
    unFocus(event);
    onEscape?.();
  }

  onKeyDown?.(event);
}
function handleWrapperClick(): void {
  target.value?.focus?.();
  focused.value = true;
}

if (listenToEvents) {
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (focusOnKeyF && event.ctrlKey && event.code === "KeyF") {
      event.preventDefault();
      handleWrapperClick();

      return;
    }

    onKeyboardEvent?.(event);
  });
}
</script>

<template>
  <div
    @click="handleWrapperClick"
    :id="`${idRoot}-wrapper`"
    :class="[
      classNames?.wrapper,
      focused ? 'cursor-text' : 'cursor-pointer',
      'shrink-0 relative w-28 sm:w-40 flex flex-nowrap items-center',
      'gap-2 rounded-md pl-2 bg-[theme(colors.neutral.100/.1)]',
    ]"
    :title="tooltip"
  >
    <div
      :id="`${idRoot}-icon`"
      :class="[
        classNames?.icon,
        icon,
        focused ? 'text-white' : 'text-neutral-400',
        'pointer-events-none absolute z-10 size-4 transition-[color]',
      ]"
    ></div>
    <input
      ref="target"
      autocomplete="off"
      :id="`${idRoot}-input`"
      :class="[
        classNames?.input,
        focused ? 'text-white' : 'text-neutral-400',
        'absolute pl-8 left-0 right-0 top-0 bottom-0 bg-transparent text-sm',
        'outline-none transition-[color] focus:outline-none placeholder-neutral-400',
      ]"
      :type="type ?? 'text'"
      :placeholder="focused ? '' : placeholder"
      :value="defaultValue"
      @input="handleInput"
      @keydown="handleKeyDown"
      @blur="unFocus"
    />
    <MaterialRipple :disabled="focused" />
  </div>
</template>

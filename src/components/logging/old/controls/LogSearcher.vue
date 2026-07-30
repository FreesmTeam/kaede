<script setup lang="ts">
import { message } from "@tauri-apps/plugin-dialog";

import CustomInput from "@/components/general/base/CustomInput.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { ApplicationName } from "@/constants/application.ts";
import type { LogControlsType } from "@/types/logging/log-controls.type.ts";

const {
  searching,
  found,
  shouldVirtualize,
  selectAllLogs,
  searchLogs,
  setSearchPosition,
  setFound,
} = defineProps<{
  "searching"        : LogControlsType["searching"];
  "found"            : Array<number>;
  "shouldVirtualize" : boolean;
  "selectAllLogs"    : () => void;
  "searchLogs"       : (newSearch: string) => Array<number>;
  "setSearchPosition": (newPosition: number, newAbsoluteValue: number | undefined) => void;
  "setFound"         : (newFound: Array<number>) => void;
}>();

function incrementIndex(): void {
  const relativePosition = Math.min(found.length, searching.relative + 1);

  setSearchPosition(relativePosition, found?.[relativePosition]);
}
function decrementIndex(): void {
  const relativePosition = Math.max(0, searching.relative - 1);

  setSearchPosition(relativePosition, found?.[relativePosition]);
}
function handleIndex(event: Event): void {
  const target = event?.target as HTMLInputElement;

  if (target?.value === undefined) {
    return;
  }

  const newValue = Number(target.value);
  const relativePosition = Math.min(
    Math.max(0, found.length),
    Math.max(
      0,
      newValue,
    ),
  );

  setSearchPosition(relativePosition, found?.[relativePosition]);
}

function handleInput(inputValue: string): void {
  setFound(searchLogs(inputValue));
}
function handleEnter(event: KeyboardEvent): void {
  if (event.key !== "Enter" || searching.current === "") {
    return;
  }

  if (event.shiftKey) {
    const relativePosition = Math.max(0, searching.relative - 1);

    setSearchPosition(relativePosition, found?.[relativePosition]);

    return;
  }

  const relativePosition = Math.min(
    Math.max(0, found.length),
    searching.relative + 1,
  );

  setSearchPosition(relativePosition, found?.[relativePosition]);
}
function handleTextSelection(event: KeyboardEvent): void {
  if (
    !event.ctrlKey ||
    event.code !== "KeyA" ||
    event.target !== document.body
  ) {
    return;
  }

  event.preventDefault();

  if (!shouldVirtualize) {
    selectAllLogs();

    return;
  }

  message(
    "Sorry, but you can't select text in the virtualized log viewer. " +
    "Either disable it or open the log file in a text editor.",
    {
      "title": ApplicationName,
      "kind" : "warning",
    },
  );
}
</script>

<template>
  <CustomInput
    icon="i-lucide-search"
    placeholder="Search..."
    id-root="__log-controls__search"
    :debounce-time="200"
    :default-value="searching.current"
    :listen-to-events="true"
    :focus-on-key-f="true"
    :on-input="handleInput"
    :on-blur="handleInput"
    :on-key-down="handleEnter"
    :on-keyboard-event="handleTextSelection"
  />
  <div
    id="__log-controls__matches-wrapper"
    :class="[
      searching.current === '' ? 'hidden' : 'flex',
      'h-full shrink-0 flex-nowrap items-center',
      'rounded-md bg-neutral-800 text-sm text-neutral-400',
    ]"
  >
    <button
      id="__log-controls__matches-increment-button"
      @click="incrementIndex"
      class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
    >
      <span id="__log-controls__matches-increment-icon" class="i-lucide-chevron-up block size-4"></span>
      <MaterialRipple />
    </button>
    <button
      id="__log-controls__matches-decrement-button"
      @click="decrementIndex"
      class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
    >
      <span id="__log-controls__matches-decrement-icon" class="i-lucide-chevron-down block size-4"></span>
      <MaterialRipple />
    </button>
    <input
      id="__log-controls__matches-input"
      class="w-8 bg-transparent pr-4 text-end outline-none sm:w-12 md:pr-0 focus:outline-none"
      type="number"
      :min="1"
      :max="Math.max(0, found.length)"
      :value="searching.relative"
      @input="handleIndex"
    />
    <p id="__log-controls__matches-text" class="hidden px-2 md:block">
      of {{ found.length }} matches
    </p>
  </div>
</template>

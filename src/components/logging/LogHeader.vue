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
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import CustomInput from "@/components/general/base/CustomInput.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { globalStates } from "@/states/global.ts";
import type { LogSearchComposableType } from "@/types/logging/log-searching.type.ts";

const { searcher, status } = defineProps<{
  "searcher": {
    "back"  : () => void;
    "next"  : () => void;
    "to"    : (index: number) => void;
    "reset" : () => void;
    "search": (input: string) => void;
  };
  "status": LogSearchComposableType["status"];
}>();

const filterer = {
  "filter": (input: string): void => {
    globalStates.logs.filtering = input;
  },
  "reset": (): void => {
    globalStates.logs.filtering = "";
  },
};

function viewInExplorer(): Promise<void> {
  const logPath = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  return revealItemInDir(logPath);
}

function onNavigation(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();

    if (event.shiftKey) {
      searcher.back();
    } else {
      searcher.next();
    }
  }

  if (event.key === "Escape") {
    searcher.reset();
  }
}

function handleIndex(event: Event): void {
  const target = event?.target as HTMLInputElement | null;
  const value: string | undefined = target?.value;

  if (!value) {
    return;
  }

  const newValue = Number(value) - 1;
  const relativePosition = Math.min(
    Math.max(0, status.matches.length),
    Math.max(
      0,
      newValue,
    ),
  );

  searcher.to(relativePosition);
}
</script>

<template>
  <div
    id="__log-viewer__header-wrapper"
    class="h-8 flex flex-wrap gap-2"
    :style="{
      'color': globalStates.ui.widget.textColor ?? '#FFFFFF',
    }"
  >
    <button
      id="__log-viewer__header-view-in-explorer"
      @click="viewInExplorer"
    >
      View in Explorer
    </button>
    <CustomInput
      focus-on-key-f
      listen-to-events
      blur-on-escape
      icon="i-lucide-search"
      placeholder="Search... (regex)"
      id-root="__log-viewer__header-search"
      :debounce-time="300"
      :default-value="status.searching"
      :on-input="searcher.search"
      :on-escape="searcher.reset"
      :on-key-down="onNavigation"
      :class-names="status.searching === '' ? undefined : {
        'wrapper': status.valid ? '' : 'border border-red',
      }"
    />
    <div
      id="__log-viewer__header-matches-wrapper"
      :class="[
        status.searching === '' ? 'hidden' : 'flex',
        'h-full shrink-0 flex-nowrap items-center',
        'rounded-md bg-neutral-800 text-sm text-neutral-400',
      ]"
    >
      <button
        id="__log-viewer__header-matches-increment-button"
        @click="searcher.back"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span id="__log-viewer__header-matches-increment-icon" class="i-lucide-chevron-up block size-4"></span>
        <MaterialRipple />
      </button>
      <button
        id="__log-viewer__header-matches-decrement-button"
        @click="searcher.next"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span id="__log-viewer__header-matches-decrement-icon" class="i-lucide-chevron-down block size-4"></span>
        <MaterialRipple />
      </button>
      <input
        v-if="status.matches.length > 0"
        id="__log-viewer__header-matches-input"
        class="w-8 bg-transparent pr-4 text-end outline-none sm:w-12 md:pr-0 focus:outline-none"
        type="number"
        :min="1"
        :max="Math.max(1, status.matches.length)"
        :value="status.index + 1"
        @input="handleIndex"
      />
      <span
        v-else
        id="__log-viewer__header-matches-placeholder"
        class="w-8 bg-transparent pr-4 text-end outline-none sm:w-12 md:pr-0 focus:outline-none"
      >
        0
      </span>
      <p id="__log-controls__matches-text" class="hidden px-2 md:block">
        of {{ status.matches.length }} matches
      </p>
    </div>
    <CustomInput
      blur-on-escape
      icon="i-lucide-list-filter"
      placeholder="Filter..."
      id-root="__log-viewer__header-filter"
      :debounce-time="200"
      :default-value="globalStates.logs.filtering"
      :on-input="filterer.filter"
      :on-escape="filterer.reset"
    />
  </div>
  <div id="__log-viewer__inner-separator" class="h-2 w-full"></div>
  <div
    id="__log-viewer__tab-sections"
    class="flex flex-nowrap items-center font-mono bg-[theme(colors.black/.3)]"
    :style="{
      'color': globalStates.ui.widget.secondaryColor ?? '#D4D4D4',
    }"
  >
    <div
      id="__log-viewer__tab-section-line-number"
      class="w-12 shrink-0 whitespace-pre text-center"
    >
      #
    </div>
    <div id="__log-viewer__tab-section-separator-1" class="mr-1 h-3 w-[1px] bg-neutral-500"></div>
    <div
      id="__log-viewer__tab-section-time"
      class="shrink-0 whitespace-pre pr-[7px]"
    >
      {{ "time".padEnd(globalStates.logs.partsSize.time) }}
    </div>
    <div id="__log-viewer__tab-section-separator-2" class="mx-1 h-3 w-[1px] bg-neutral-500"></div>
    <div
      id="__log-viewer__tab-section-level"
      class="shrink-0 whitespace-pre pr-[7px]"
    >
      {{ "level".padEnd(globalStates.logs.partsSize.level) }}
    </div>
    <div id="__log-viewer__tab-section-separator-3" class="mx-1 h-3 w-[1px] bg-neutral-500"></div>
    <div
      id="__log-viewer__tab-section-target"
      class="shrink-0 whitespace-pre pr-[7px]"
    >
      {{ "target".padEnd(globalStates.logs.partsSize.target) }}
    </div>
    <div id="__log-viewer__tab-section-separator-4" class="mx-1 h-3 w-[1px] bg-neutral-500"></div>
    <div
      id="__log-viewer__tab-section-message"
      class="shrink-0"
    >
      message
    </div>
  </div>
</template>

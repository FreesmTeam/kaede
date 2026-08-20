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
import { inject, type ShallowReactive } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import CustomInput from "@/components/general/base/CustomInput.vue";
import CustomSelect from "@/components/general/base/CustomSelect.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import LogCopy from "@/components/logging/header/LogCopy.vue";
import LogSections from "@/components/logging/header/LogSections.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { InstanceLogsContextKey } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { globalStates } from "@/states/global.ts";
import type { LogSearchComposableType } from "@/types/logging/log-searching.type.ts";

const { size, searcher, status } = defineProps<{
  "size"    : number;
  "searcher": {
    "back"  : () => void;
    "next"  : () => void;
    "to"    : (index: number) => void;
    "reset" : () => void;
    "search": (input: string) => void;
  };
  "status": LogSearchComposableType["status"];
}>();

const { styles } = useConfigColors();

const instanceLogs = inject<ShallowReactive<Record<
  string,
  { "list": Array<string> }
>>>(InstanceLogsContextKey);

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
  <div id="__log-viewer__inner-title-wrapper" class="flex flex-nowrap justify-between gap-2">
    <div id="__log-viewer__inner-title" class="text-xl font-semibold leading-none">
      Logs
    </div>
    <button
      id="__log-viewer__inner-close-button"
      class="relative rounded-md p-1 transition-[background-color] hover:bg-[theme(colors.white/.05)]"
      @click="() => globalStates.logs.show = false"
    >
      <span id="__log-viewer__inner-close-button-icon" class="i-lucide-x block size-5"></span>
      <MaterialRipple />
    </button>
  </div>
  <div id="__log-viewer__inner-separator" class="h-2 w-full"></div>
  <div id="__log-viewer__inner-subtitle-wrapper" class="flex flex-nowrap items-center gap-2">
    <div id="__log-viewer__inner-subtitle-part-left" :style="styles.widgetSecondary">
      View
    </div>
    <CustomSelect
      tooltip="Select mode..."
      id-root="__log-viewer__header-select-mode"
      :value="globalStates.logs.mode"
      :on-select="value => globalStates.logs.mode = value.id"
      :options="
        ['kaede-launcher', ...Object.keys(instanceLogs ?? {})].map(currentId => {
          if (currentId === 'kaede-launcher') {
            return { 'id': 'kaede-launcher', 'label': 'Kaede' };
          }

          return { 'id': currentId, 'label': currentId };
        })
      "
    />
    <div id="__log-viewer__inner-subtitle-part-right" :style="styles.widgetSecondary">
      logs
    </div>
    <div id="__log-viewer__inner-subtitle-part-additional" class="opacity-80" :style="styles.widgetSecondary">
      ({{ size }} lines)
    </div>
    <CustomButton
      hide="md"
      id-root="__log-viewer__header-view-in-explorer"
      label="View in Explorer"
      tooltip="View the log file in Explorer"
      icon="i-lucide-external-link"
      :on-click="viewInExplorer"
      class="min-h-8"
    />
    <LogCopy />
  </div>
  <div id="__log-viewer__inner-separator" class="h-2 w-full"></div>
  <div
    id="__log-viewer__header-wrapper"
    class="h-8 flex flex-nowrap gap-2"
    :style="{ 'color': globalStates.ui.widget.textColor || '#FFFFFF' }"
  >
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
        'rounded-md bg-[theme(colors.neutral.100/.1)] text-sm',
      ]"
      :style="styles.widgetSecondary"
    >
      <button
        id="__log-viewer__header-matches-increment-button"
        @click="searcher.back"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[background-color] hover:bg-[theme(colors.neutral.100/.1)]"
      >
        <span id="__log-viewer__header-matches-increment-icon" class="i-lucide-chevron-up block size-4"></span>
        <MaterialRipple />
      </button>
      <button
        id="__log-viewer__header-matches-decrement-button"
        @click="searcher.next"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[background-color] hover:bg-[theme(colors.neutral.100/.1)]"
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
      :debounce-time="300"
      :default-value="globalStates.logs.filtering"
      :on-input="filterer.filter"
      :on-escape="filterer.reset"
    />
  </div>
  <div id="__log-viewer__inner-separator" class="h-2 w-full"></div>
  <LogSections />
</template>

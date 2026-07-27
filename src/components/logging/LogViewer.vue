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
import {
  computed, inject, nextTick,
  onMounted, ref, type ShallowReactive,
  shallowRef, useTemplateRef, watchEffect,
} from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import LogControls from "@/components/logging/controls/LogControls.vue";
import LogHeader from "@/components/logging/header/LogHeader.vue";
import NonVirtualizedLogs from "@/components/logging/wrappers/NonVirtualizedLogs.vue";
import VirtualizedLogs from "@/components/logging/wrappers/VirtualizedLogs.vue";
import { InstanceLogsContextKey } from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";

const instanceLogs = inject<ShallowReactive<Record<string, string[]>>>(InstanceLogsContextKey);

const virtualList = useTemplateRef("virtualList");
const nonVirtualList = useTemplateRef("nonVirtualList");

const logs = shallowRef<Array<string>>(["__kaede-trigger-loading"]);
// References the launcher logs even if user is viewing instance logs
const launcherLogsReference = shallowRef<Array<string>>(logs.value);

const fileData = ref<{
  "size": string | undefined;
  "time": string | undefined;
}>({ "size": undefined, "time": undefined });
const searching = ref<{
  // Takes a searching value
  "current"     : string;
  // Takes indexes from the relative matches array (example: [0, 1, 2, ...])
  "relative"    : number;
  // Takes indexes from the logs array (example: [4, 23, 95, ...])
  "absolute"    : number | undefined;
  // Stores the current search index
  "currentIndex": number | undefined;
}>({
  "current"     : "",
  "relative"    : 1,
  "absolute"    : undefined,
  "currentIndex": undefined,
});
// A key that re-renders virtualized list on every log viewer reopen
const mountedKey = ref<number>(Math.random());
// Keeps track of index range text selections in virtualized mode
const currentTextSelection = ref<[number, number] | undefined>(undefined);

const filtering = computed((): string => globalStates?.logs?.filtering ?? "");
const filteredLogs = computed((): (Array<[number, string]> | undefined) => {
  if (filtering.value === "") {
    return undefined;
  }

  const filteredArray: Array<[number, string]> = [];

  for (const [_index, _log] of logs.value.entries()) {
    if (_log.toLowerCase().includes(filtering.value.toLowerCase())) {
      filteredArray.push([_index, _log]);
    }
  }

  return filteredArray;
});

function scrollToIndex(index: number): void {
  searching.value.currentIndex = filteredLogs.value?.[index]?.[0];
  virtualList?.value?.scrollToIndex?.(index);
}
function setSearchPosition(newValue: number, newAbsoluteValue: number | undefined): void {
  searching.value.relative = newValue;
  searching.value.absolute = newAbsoluteValue;
}
function setTextSelectionRange(newValue: [number, number] | undefined): void {
  currentTextSelection.value = newValue;
}
function selectAllLogs(): void {
  Logging.selectAllText(nonVirtualList.value?.nonVirtualizedLogsTarget);
}

function searchLogs(searchValue: string): Array<number> {
  const found: Array<number> = [];
  const lowerCaseSearch: string = searchValue.toLowerCase();
  const currentLogsArray: Array<string | [number, string]> = filteredLogs.value ?? logs.value;

  searching.value.current = lowerCaseSearch;

  for (const [index, value] of currentLogsArray.entries()) {
    const actualValue = typeof value === "string" ? value : value[1];

    if (actualValue.toLowerCase().includes(lowerCaseSearch)) {
      found.push(index);
    }
  }

  return found;
}

watchEffect(() => {
  const currentLogsMode: "launcher" | string | undefined = globalStates?.logs?.mode;

  if (currentLogsMode === undefined) {
    return log.error(__PRE_BUNDLED_FILENAME__, `The selected logs mode is '${currentLogsMode}'`);
  }

  log.debug(__PRE_BUNDLED_FILENAME__, `The selected logs mode is '${currentLogsMode}'`);
  if (currentLogsMode === "launcher") {
    const logsLength: number = launcherLogsReference.value.length;

    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `Using a previously saved reference to the launcher logs (length: ${logsLength})`,
    );
    logs.value = launcherLogsReference.value;
  } else {
    const currentInstanceLogs: Array<string> | undefined = instanceLogs?.[currentLogsMode];
    let shouldReassignLauncherLogs: boolean = true;
    const allInstanceLogs = Object.values(instanceLogs ?? {});

    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `Using an instance logs (length: ${currentInstanceLogs?.length})`,
    );
    for (const instanceLogsReference of allInstanceLogs) {
      if (logs.value === instanceLogsReference) {
        shouldReassignLauncherLogs = false;
      }
    }

    if (shouldReassignLauncherLogs) {
      // Re-assign the launcher logs reference only if the current logs are actually launcher logs
      launcherLogsReference.value = logs.value;
    }

    logs.value = currentInstanceLogs ?? [];
  }
});

onMounted(async () => {
  if (globalStates?.logs?.mode && instanceLogs?.[globalStates.logs.mode] === undefined) {
    // Reset to launcher logs if the instance logs do not exist (if just empty, then do not reset)
    GlobalStateHelpers.Logs.selectMode("launcher");
  }

  const startTime = performance.now();

  // Notify virtualized list component that it should re-render
  mountedKey.value = Math.random();

  const { "size": filesize, "logs": existingLogs, currentInstanceLogs } =
    await Logging.readLogs({ globalStates, instanceLogs });

  logs.value = globalStates?.logs?.mode === "launcher" ? existingLogs : currentInstanceLogs;
  // Update the reference to the launcher logs
  launcherLogsReference.value = existingLogs;

  const endTime = performance.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  fileData.value.time = `took ${totalTime}s`;
  fileData.value.size = `${filesize} MB`;

  await nextTick();
  // Virtual list does not scroll to its end unless we wait two (???) Vue ticks
  await nextTick();

  virtualList.value?.scrollToEnd?.();
});
</script>

<template>
  <div
    id="__log-viewer__wrapper"
    @contextmenu.prevent
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 grid place-items-center bg-[theme(colors.black/.5)]"
  >
    <div
      id="__log-viewer__inner"
      @contextmenu.prevent
      @contextmenu="GlobalStateHelpers.showContextMenu"
      class="h-fit max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] w-fit flex flex-col gap-2 rounded-md bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div id="__log-viewer__information-wrapper" class="w-full flex shrink-0 flex-nowrap items-start justify-between gap-4 pb-2">
        <div id="__log-viewer__information-text-wrapper" class="flex flex-col gap-2">
          <p id="__log-viewer__information-title" class="text-xl font-medium leading-none">
            Logs
          </p>
          <p id="__log-viewer__information-subtitle" class="text-neutral-300">
            <LogHeader />
            <span
              v-if="fileData?.size !== undefined && fileData?.time !== undefined"
              id="__log-viewer__information-subtitle-file-data"
              class="text-neutral-400"
            >
              ({{ fileData.size }}, {{ fileData.time }})
            </span>
          </p>
          <LogControls
            :searching="searching"
            :set-search-position="setSearchPosition"
            :search-logs="searchLogs"
            :scroll-to-index="scrollToIndex"
            :select-all-logs="selectAllLogs"
            :text-selection-range="currentTextSelection"
            :set-text-selection-range="setTextSelectionRange"
            :logs-array="filteredLogs ?? logs"
          />
        </div>
        <button
          id="__log-viewer__close-logs-button"
          class="relative rounded-md p-2 hover:bg-neutral-800"
          @click="Logging.closeViewer"
        >
          <span id="__log-viewer__close-logs-icon" class="i-lucide-x block size-5"></span>
          <MaterialRipple />
        </button>
      </div>
      <div
        id="__log-viewer__virtual-list-wrapper"
        class="group relative max-w-320 w-[calc(100vw-128px)] overflow-auto border border-neutral-300 bg-neutral-950 text-sm font-mono"
      >
        <VirtualizedLogs
          v-if="globalStates?.logs?.virtualized"
          ref="virtualList"
          :logs="logs"
          :filtered-logs="filteredLogs"
          :filtering="filtering"
          :mounted-key="mountedKey"
          :searching="searching"
          :current-text-selection="currentTextSelection"
        />
        <NonVirtualizedLogs
          v-else
          ref="nonVirtualList"
          :logs="filteredLogs ?? logs"
          :searching="searching"
          :horizontal-scroll="globalStates?.logs?.lineBreaks === false"
        />
      </div>
    </div>
  </div>
</template>

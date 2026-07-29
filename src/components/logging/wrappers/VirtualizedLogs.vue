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
import { refThrottled, useWindowSize } from "@vueuse/core";
import { useTemplateRef } from "vue";
// @ts-expect-error Later
import { VirtualisedList } from "vue-virtualised";

import LogEntry from "@/components/logging/lines/LogEntry.vue";
import { globalStates } from "@/states/global.ts";

const { logs, filteredLogs, filtering, mountedKey, searching, currentTextSelection } = defineProps<{
  "logs"        : Array<string>;
  "filteredLogs": Array<[number, string]> | undefined;
  "filtering"   : string;
  "mountedKey"  : number;
  "searching"           : {
    // Takes a searching value
    "current"     : string;
    // Takes indexes from the relative matches array (example: [0, 1, 2, ...])
    "relative"    : number;
    // Takes indexes from the logs array (example: [4, 23, 95, ...])
    "absolute"    : number | undefined;
    // Stores the current search index
    "currentIndex": number | undefined;
  };
  "currentTextSelection": [number, number] | undefined;
}>();

const target = useTemplateRef("target");

defineExpose<{
  "scrollToIndex": (index: number) => void;
  "scrollToEnd"  : () => void;
}>({
  "scrollToIndex": (index: number): void => {
    target.value?.scrollToIndex?.(index);
  },
  "scrollToEnd": (): void => {
    target.value?.scrollToEnd?.();
  },
});

const { height } = useWindowSize();
// Throttled window height is used for the virtualized list height
const throttledHeight = refThrottled(height, 200);

/*
 * The number 1280 is just the maximum width of the container
 *
 * Subtract 128 to exclude the margins and paddings
 *          18  to exclude the approximate scrollbar width
 *          56  to exclude the line number width
 *          12  to exclude the paddings (px-1 & gap-1)
 */
const virtualScrollContainerTextWidth = Math.min(1280, window.innerWidth - 128) - 18 - 56 - 12;

/*
 * ~7.66 is a magical number that was obtained by dividing one line of a mono text
 * by the count of its characters.
 */
const charactersPerLine = Math.floor(virtualScrollContainerTextWidth / 7.66);
const nodeLineSize = 20;

function getNodeHeight(node: string | [number, string]): number {
  const actualNodeLine = typeof node === "string" ? node : node[1];

  if (actualNodeLine.length === 0) {
    return nodeLineSize;
  }

  return nodeLineSize * Math.ceil(actualNodeLine.length / charactersPerLine);
}
</script>

<template>
  <VirtualisedList
    :key="
      `${logs.length}-${filtering}-
       ${throttledHeight}-${globalStates?.logs?.mode}-${mountedKey}`
    "
    :get-node-height="getNodeHeight"
    :viewport-height="throttledHeight - 248"
    :nodes="filteredLogs ?? logs"
    id="__virtualized-list-logs"
    class="w-full"
    ref="target"
  >
    <template #cell="slotProps">
      <LogEntry
        :line="slotProps.node"
        :index="typeof slotProps.node === 'string'
          ? slotProps.index
          : slotProps.node[0]"
        :searching="searching"
        :selection-indexes="currentTextSelection"
      />
    </template>
  </VirtualisedList>
</template>

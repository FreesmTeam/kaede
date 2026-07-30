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
import { useWindowSize } from "@vueuse/core";
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";

import LogHeader from "@/components/logging/LogHeader.vue";
import { useLogSearch } from "@/composables/use-log-search.ts";
import { useLogStream } from "@/composables/use-log-stream.ts";
import { parseLine } from "@/lib/logging/parser.ts";
import { overlaySearch, tokenize } from "@/lib/logging/renderer.ts";
import { globalStates } from "@/states/global.ts";
import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type { LogRenderSegmentType } from "@/types/logging/log-render.type.ts";

const { lines } = useLogStream();
const { "height": innerHeight } = useWindowSize();

const scrollBarSize = 17;

const position = ref<number>(0);

const filtered = computed((): { "list": Array<LogLineType> } => {
  const filtering: string = globalStates.logs.filtering.trim().toLowerCase();
  const original: Array<string> = lines.value.list;

  if (filtering === "") {
    return {
      "list": original.map((line: string, index: number) => ({ "raw": line, index })),
    };
  }

  const result: Array<LogLineType> = [];

  for (const [index, line] of original.entries()) {
    if (line.toLowerCase().includes(filtering)) {
      result.push({ "raw": line, index });
    }
  }

  return { "list": result };
});

const { status, matchesByLine, utils } = useLogSearch(filtered);

const elements = computed((): number[] => {
  const region: number = innerHeight.value - 280;
  const boundary: number = Math.ceil(region / globalStates.logs.lineHeight);
  const size: number = Math.min(boundary, filtered.value.list.length);

  return Array.from({ "length": size }, (_, index) => index);
});

const container = useTemplateRef("container");

// Update the logs array index (called on scroll)
function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / globalStates.logs.lineHeight);
}

// Stick to the bottom of the log viewer unless
watch(
  () => [
    lines.value.list.length,
    elements.value.length,
  ],
  async () => {
    if (!container.value) {
      return;
    }

    const viewer = container.value;
    const twoLinesHeight = globalStates.logs.lineHeight * 2;
    const toCatchRange = viewer.scrollTop + twoLinesHeight + 1;
    const isAtTheBottom = viewer.scrollHeight - viewer.clientHeight <= toCatchRange;

    await nextTick();

    if (isAtTheBottom) {
      viewer.scrollTo({ "top": viewer.scrollHeight - viewer.clientHeight });
    }
  },
);

function getSegments(filteredIndex: number): Array<LogRenderSegmentType> {
  const entry = filtered.value.list[filteredIndex];

  if (!entry) {
    return [];
  }

  const matches = matchesByLine.value.get(filteredIndex);
  const hasMatches = matches && matches.length > 0;

  const parsed = parseLine(entry);
  const tokens = tokenize(parsed);

  return hasMatches
    ? overlaySearch(tokens, matches, status.index)
    : tokens.map((rawToken, index) => ({
      "text" : rawToken.text,
      "kind" : rawToken.kind,
      "state": "none",
      index,
    }));
}

function scrollToMatch(match: { "lineIndex": number } | undefined): void {
  if (!match || !container.value) {
    return;
  }

  const targetTop =
    (match.lineIndex * globalStates.logs.lineHeight) -
    (container.value.clientHeight / 2) +
    globalStates.logs.lineHeight;

  container.value.scrollTo({ "top": Math.max(0, targetTop), "behavior": "instant" });
}

const searcher: {
  "back"  : () => void;
  "next"  : () => void;
  "reset" : () => void;
  "search": (input: string) => void;
} = {
  "back"  : (): void => scrollToMatch(utils.previous()),
  "next"  : (): void => scrollToMatch(utils.next()),
  "reset" : utils.reset,
  "search": (input: string): void => {
    status.searching = input;
  },
};

onMounted(() => container?.value?.addEventListener?.("scroll", updateView, { "passive": true }));
onUnmounted(() => container?.value?.removeEventListener?.("scroll", updateView));
</script>

<template>
  <div
    @contextmenu.prevent
    id="__log-viewer__wrapper"
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 flex flex-col justify-center gap-2 px-16 text-start text-sm bg-[theme(colors.black/.5)]"
    v-show="lines.list.length > 0"
  >
    <LogHeader :searcher="searcher" :status="status" />
    <div
      id="__log-viewer__inner"
      class="w-full select-text"
    >
      <div
        id="__log-viewer__bound"
        class="relative w-full select-text overflow-scroll"
        ref="container"
        :style="{ 'height': elements.length * globalStates.logs.lineHeight + scrollBarSize + 'px' }"
      >
        <!-- eslint-disable @vue-require-id/require-id -->
        <div
          id="__log-viewer__scroll-placeholder"
          class="w-fit font-mono"
          :style="{
            'height': filtered.list.length * globalStates.logs.lineHeight + 'px',
          }"
        >
          <div
            v-for="index in elements"
            :key="index"
            class="__log-viewer__log-line"
            :style="{ 'top': index * globalStates.logs.lineHeight + 'px' }"
          >
            <div
              class="w-12 shrink-0 text-center text-neutral-300"
            >
              {{ filtered?.list?.[position + index]?.index }}
            </div>
            <template
              v-for="segment in getSegments(position + index)"
              :key="`${index}-${segment.index}`"
            >
              <mark
                v-if="segment.state !== 'none'"
                :class="[
                  'rounded-[2px]',
                  segment.state === 'current'
                    ? 'bg-orange-500/80 text-white'
                    : 'bg-yellow-400/25 text-inherit',
                ]"
              >
                {{ segment.text }}
              </mark>
              <div v-else>
                {{ segment.text }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type ShallowReactive,
  useTemplateRef,
  watch,
} from "vue";

import LogHeader from "@/components/logging/LogHeader.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useLogSearch } from "@/composables/use-log-search.ts";
import { useLogSegmentation } from "@/composables/use-log-segmentation.ts";
import { useLogStream } from "@/composables/use-log-stream.ts";
import { InstanceLogsContextKey } from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { globalStates } from "@/states/global.ts";
import type { LogLineType } from "@/types/logging/log-line.type.ts";

const instanceLogs = inject<ShallowReactive<Record<
  string,
  { "list": Array<string> }
>>>(InstanceLogsContextKey);

const { styles } = useConfigColors();
const { lines } = useLogStream();
const { "height": innerHeight } = useWindowSize();

const scrollBarSize = 17;

const position = ref<number>(0);

const filtered = computed((): { "list": Array<LogLineType> } => {
  const filtering: string = globalStates.logs.filtering.trim().toLowerCase();
  const original: Array<string> = globalStates.logs.mode === "kaede-launcher"
    ? lines.value.list
    : instanceLogs?.[globalStates.logs.mode]?.list ?? [];

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

const boundary = computed((): number => {
  const region: number = innerHeight.value - 280;

  return Math.ceil(region / globalStates.logs.lineHeight);
});
const elements = computed((): number[] => {
  const size: number = Math.min(boundary.value, filtered.value.list.length);

  return Array.from({ "length": size }, (_, index) => index);
});

const { segments } = useLogSegmentation({ filtered, matchesByLine, elements, status, position });

const container = useTemplateRef("container");

// Update the logs array index (called on scroll)
function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / globalStates.logs.lineHeight);
}

// Stick to the bottom of the log viewer
watch(
  () => [
    filtered.value.list.length,
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
  "to"    : (index: number) => void;
  "reset" : () => void;
  "search": (input: string) => void;
} = {
  "back"  : (): void => scrollToMatch(utils.previous()),
  "next"  : (): void => scrollToMatch(utils.next()),
  "to"    : (index: number): void => scrollToMatch(utils.goTo(index)),
  "reset" : utils.reset,
  "search": (input: string): void => {
    status.searching = input;
  },
};

onMounted(() => container?.value?.addEventListener?.("scroll", updateView, { "passive": true }));
onUnmounted(() => container?.value?.removeEventListener?.("scroll", updateView));

// Expose log arrays for plugins
GlobalInternals.logs = {
  "raw"     : lines,
  "filtered": filtered,
};
</script>

<template>
  <!-- For some reason, 'grid place-items-center' breaks layout, so we use 'flex items-center' -->
  <div
    @contextmenu.prevent
    id="__log-viewer__wrapper"
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 flex px-20 pt-11 text-start text-sm bg-[theme(colors.black/.5)]"
  >
    <div
      id="__log-viewer__inner"
      class="h-fit w-full flex flex-col rounded-md p-4"
      :style="styles.widget"
    >
      <LogHeader :size="filtered.list.length" :searcher="searcher" :status="status" />
      <div
        id="__log-viewer__bound-wrapper"
        class="w-full border-x border-b border-neutral-500 bg-[theme(colors.black/.2)]"
      >
        <div
          id="__log-viewer__bound"
          class="relative w-full select-text overflow-scroll"
          ref="container"
          :style="{
            'height': boundary * globalStates.logs.lineHeight + scrollBarSize + 'px',
          }"
        >
          <div
            id="__log-viewer__scroll-placeholder"
            class="w-fit font-mono"
            :style="{ 'height': filtered.list.length * globalStates.logs.lineHeight + 'px' }"
          >
            <div
              v-for="index in elements"
              :key="index"
              :id="`__log-viewer__log-line-${index}`"
              :style="{ 'top': index * globalStates.logs.lineHeight + 'px' }"
              class="__log-viewer__log-line"
            >
              <div
                :id="`__log-viewer__log-line-number-${index}`"
                class="w-12 shrink-0 select-none text-center"
                :style="{
                  'color': globalStates.ui.widget.secondaryColor ?? '#D4D4D4',
                }"
              >
                {{ filtered?.list?.[position + index]?.index }}
              </div>
              <template
                v-for="segment in segments[index]"
                :key="`${index}-${segment.index}`"
              >
                <mark
                  v-if="segment.state !== 'none'"
                  :id="`__log-viewer__log-line-segment-${index}-${segment.index}`"
                  :class="[
                    'rounded-sm text-white',
                    // Here we use 'mr-4' instead of 'pr-4' to not expand background yet have a gap
                    segment.gap ? 'mr-4' : '',
                    segment.state === 'current' ? 'bg-blue-500/80' : 'bg-blue-400/25',
                  ]"
                >
                  {{ segment.text }}
                </mark>
                <div
                  v-else
                  :id="`__log-viewer__log-line-segment-${index}-${segment.index}`"
                  :class="[segment.class, segment.gap ? 'pr-4' : '']"
                >
                  {{ segment.text }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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

import { useLogStream } from "@/composables/use-log-stream.ts";
import { globalStates } from "@/states/global.ts";

const { lines } = useLogStream();
const { "height": innerHeight } = useWindowSize();

const scrollBarSize = 17;

const position = ref<number>(0);

const filtered = computed((): { "list": Array<string> } => {
  const filtering: string = globalStates.logs.filtering;

  if (!filtering) {
    return lines.value;
  }

  const filtered: Array<string> = [];

  for (const line of lines.value.list) {
    filtered.push(line);
  }

  return { "list": filtered };
});
const elements = computed((): Array<number> => {
  const region: number = innerHeight.value - 280;
  const boundary: number = Math.ceil(region / globalStates.logs.lineHeight);
  const size: number = Math.min(boundary, filtered.value.list.length);

  return Array.from({ "length": size }).map((_, index) => index);
});

const container = useTemplateRef("container");

function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / globalStates.logs.lineHeight);
}

watch(
  () => [
    lines.value,
    elements.value,
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
    <div>
      asd ayo
    </div>
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
        <div
          id="__log-viewer__scroll-placeholder"
          class="w-fit font-mono"
          :style="{
            'height': lines.list.length * globalStates.logs.lineHeight + 'px',
          }"
        >
          <!-- eslint-disable-next-line @vue-require-id/require-id -->
          <div
            v-for="index in elements"
            :key="index"
            class="__log-viewer__log-line"
            :style="{ 'top': index * globalStates.logs.lineHeight + 'px' }"
          >
            {{ position + index }} {{ filtered.list?.[position + index] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

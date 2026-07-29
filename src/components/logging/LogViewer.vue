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
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";

import { useLogStream } from "@/composables/use-log-stream.ts";
import { globalStates } from "@/states/global.ts";

const { lines } = useLogStream();

// TODO
const hideDetails = false;

const filtered = computed((): Array<string> => {
  const filtered: Array<string> = [];

  for (const line of lines.value.list) {
    const part: string = line.slice(0, 2).trim();
    const areDetails = Number.isNaN(
      Number(part === "" ? "no" : part),
    );

    if (!hideDetails) {
      filtered.push(line);

      continue;
    }

    if (!areDetails) {
      filtered.push(line);
    }
  }

  return filtered;
});

const position = ref<number>(0);

const container = useTemplateRef("container");

function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / globalStates.logs.lineHeight);
}

watch(
  () => lines.value,
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

onMounted(() => {
  if (!container.value) {
    return;
  }

  container.value.addEventListener("scroll", updateView, { "passive": true });
});
onUnmounted(() => {
  if (!container.value) {
    return;
  }

  container.value.removeEventListener("scroll", updateView);
});
</script>

<template>
  <div
    @contextmenu.prevent
    id="__log-viewer__wrapper"
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 flex items-start p-16 text-start text-sm bg-[theme(colors.black/.5)]"
    v-show="lines.list.length > 0"
  >
    <div
      id="__log-viewer__inner"
      class="w-full flex-1 select-text"
    >
      <div
        id="__log-viewer__bound"
        class="relative w-full select-text overflow-y-auto"
        ref="container"
        :style="{ 'height': 16 * globalStates.logs.lineHeight + 'px' }"
      >
        <div
          id="__log-viewer__scroll-placeholder"
          class="font-mono"
          :style="{
            'height': lines.list.length * globalStates.logs.lineHeight + 'px',
          }"
        >
          <div
            v-for="(_, index) in Array.from({ length: 16 })"
            :key="index"
            :id="`${index}-log-line`"
            class="__log-viewer__log-line"
            :style="{ 'top': index * globalStates.logs.lineHeight + 'px' }"
          >
            {{ position + index }} {{ filtered?.[position + index] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

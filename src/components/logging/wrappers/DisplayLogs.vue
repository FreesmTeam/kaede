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
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

import { globalStates } from "@/states/global.ts";

const { logs } = defineProps<{
  "logs": Array<string>;
}>();

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
  () => logs,
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
    id="__log-viewer__bound"
    class="relative w-full select-text overflow-y-auto"
    ref="container"
    :style="{ 'height': 16 * globalStates.logs.lineHeight + 'px' }"
  >
    <div
      id="__log-viewer__scroll-placeholder"
      class="font-mono"
      :style="{
        'height': logs.length * globalStates.logs.lineHeight + 'px',
      }"
    >
      <div
        v-for="(_, index) in Array.from({ length: 16 })"
        :key="index"
        :id="`${index}-log-line`"
        class="__log-viewer__log-line"
        :style="{ 'top': index * globalStates.logs.lineHeight + 'px' }"
      >
        {{ position + index }} {{ logs?.[position + index] }}
      </div>
    </div>
  </div>
</template>

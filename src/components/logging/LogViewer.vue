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

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import LogHeader from "@/components/logging/header/LogHeader.vue";
import { useLogStream } from "@/composables/use-log-stream.ts";
import { InstanceLogsContextKey } from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Logging from "@/lib/logging";
import { globalStates } from "@/states/global.ts";

const { "lines": launcherLines } = useLogStream();
const instanceLogs = inject<ShallowReactive<Record<string, string[]>>>(InstanceLogsContextKey);

// TODO
const shouldHideDetails = false;

const selectedLines = computed((): Array<string> => {
  const mode = globalStates.logs?.mode ?? "launcher";

  return mode === "launcher"
    ? launcherLines.value.list
    : (instanceLogs?.[mode] ?? []);
});

const filtered = computed((): Array<string> => {
  const filtered: Array<string> = [];

  for (const line of selectedLines.value) {
    if (!shouldHideDetails) {
      filtered.push(line);

      continue;
    }

    const part: string = line.slice(0, 2).trim();
    const areDetails = Number.isNaN(
      Number(part === "" ? "no" : part),
    );

    if (!areDetails) {
      filtered.push(line);
    }
  }

  return filtered;
});

const position = ref<number>(0);
const visibleLineCount = computed((): number => {
  return Math.max(0, Math.min(16, filtered.value.length - position.value));
});

const container = useTemplateRef("container");

function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / GlobalInternals.logLineHeight);
}

watch(
  () => [globalStates.logs?.mode, filtered.value.length] as const,
  async ([mode], [previousMode]) => {
    position.value = mode === previousMode
      ? Math.min(position.value, Math.max(0, filtered.value.length - 16))
      : 0;

    if (!container.value) {
      return;
    }

    const viewer = container.value;
    const twoLinesHeight = GlobalInternals.logLineHeight * 2;
    const toCatchRange = viewer.scrollTop + twoLinesHeight + 1;
    const isAtTheBottom = viewer.scrollHeight - viewer.clientHeight <= toCatchRange;

    await nextTick();

    if (isAtTheBottom) {
      viewer.scrollTo({ "top": viewer.scrollHeight - viewer.clientHeight });
    }
  },
);

function closeViewer(): void {
  Logging.closeViewer();
}

onMounted(() => {
  const mode = globalStates.logs?.mode;

  if (mode !== undefined && mode !== "launcher" && instanceLogs?.[mode] === undefined) {
    GlobalStateHelpers.Logs.selectMode("launcher");
  }

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
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 grid place-items-center p-16 text-start text-sm bg-[theme(colors.black/.5)]"
  >
    <div
      id="__log-viewer__inner"
      class="max-w-320 w-full flex flex-col gap-3 rounded-md bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div id="__log-viewer__header" class="flex items-center justify-between gap-4">
        <LogHeader />
        <button
          id="__log-viewer__close-logs-button"
          aria-label="Close logs"
          class="relative rounded-md p-2 hover:bg-neutral-800"
          type="button"
          @click="closeViewer"
        >
          <span id="__log-viewer__close-logs-icon" class="i-lucide-x block size-5"></span>
          <MaterialRipple />
        </button>
      </div>
      <div
        id="__log-viewer__bound"
        class="relative w-full select-text overflow-y-auto border border-neutral-300 bg-neutral-950"
        ref="container"
        :style="{ 'height': 16 * GlobalInternals.logLineHeight + 'px' }"
      >
        <div
          id="__log-viewer__scroll-placeholder"
          class="font-mono"
          :style="{
            'height': filtered.length * GlobalInternals.logLineHeight + 'px',
          }"
        >
          <p
            v-if="filtered.length === 0"
            id="__log-viewer__empty-state"
            class="p-2 text-neutral-400"
          >
            No logs are available for this source.
          </p>
          <div
            v-for="(_, index) in Array.from({ length: visibleLineCount })"
            :key="position + index"
            :id="`${position + index}-log-line`"
            class="__log-viewer__log-line"
            :style="{ 'top': index * GlobalInternals.logLineHeight + 'px' }"
          >
            {{ position + index }} {{ filtered?.[position + index] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

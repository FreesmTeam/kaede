<script setup lang="ts">
import { useDraggable } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

import CpuUsage from "@/components/general/development-mode/CpuUsage.vue";
import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import MemoryUsage from "@/components/general/development-mode/MemoryUsage.vue";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const container = useTemplateRef("container");

const development = computed((): GlobalStatesType["development"] => {
  return globalStates.development;
});

const { style } = useDraggable(container, {
  "containerElement": document.getElementById("app"),
});
</script>

<template>
  <div
    ref="container"
    id="__dev-mode__wrapper"
    class="fixed z-9500 flex flex-col cursor-move"
    :style="style"
  >
    <FramesPerSecond v-if="development.showFPS" />
    <div id="__dev-mode__column" class="flex flex-nowrap justify-between">
      <MemoryUsage v-if="development.showMemoryUsage" />
      <CpuUsage v-if="development.showCPUUsage" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CpuUsage from "@/components/general/development-mode/CpuUsage.vue";
import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import MemoryUsage from "@/components/general/development-mode/MemoryUsage.vue";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const development = computed((): GlobalStatesType["development"] => {
  return globalStates.development;
});
</script>

<template>
  <div
    id="__dev-mode__wrapper"
    class="pointer-events-none fixed right-0 top-0 z-9500 flex flex-nowrap"
  >
    <CpuUsage v-if="development.showCPUUsage" />
    <MemoryUsage v-if="development.showMemoryUsage" />
    <FramesPerSecond v-if="development.showFPS" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const development = computed((): GlobalStatesType["development"] => {
  return globalStates.development;
});
</script>

<template>
  <FramesPerSecond v-if="development.showFPS" />
</template>

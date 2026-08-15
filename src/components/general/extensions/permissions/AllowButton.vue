<script setup lang="ts">
import { onMounted, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const { onClick } = defineProps<{
  "onClick": () => void;
}>();

// No one wants to accidentally allow an extension permission
const timeout = ref<number>(5000);
let previous: number = performance.now();

function decrease(): void {
  const current: number = performance.now();
  const difference: number = current - previous;

  timeout.value = timeout.value - difference;
  previous = current;

  if (timeout.value <= 0) {
    return;
  }

  requestAnimationFrame(decrease);
}

onMounted((): void => {
  requestAnimationFrame(decrease);
});
</script>

<template>
  <button
    :disabled="timeout > 0"
    id="__extensions-loader__permission-request-allow-wrapper"
    @click="onClick"
    class="group relative flex flex-nowrap rounded-md bg-neutral-800 px-3 py-1 transition-[opacity,background-color] disabled:bg-red-800 disabled:opacity-60"
  >
    <span
      id="__extensions-loader__permission-request-allow-label"
      class="text-white transition-[color] group-disabled:text-red-300"
    >
      Yes
    </span>
    <span
      v-if="timeout > 0"
      id="__extensions-loader__permission-request-allow-timer-label"
      class="text-red-300"
    >
      {{ `, ${(timeout / 1000).toFixed(2)}` }}
    </span>
    <MaterialRipple v-if="timeout <= 0" />
  </button>
</template>

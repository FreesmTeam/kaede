<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const { onClick } = defineProps<{
  "onClick": () => void;
}>();

// No one wants to accidentally allow an extension permission
const timeout = ref<number>(30);

const { pause } = useIntervalFn(() => {
  if (timeout.value <= 0) {
    pause();

    return;
  }

  timeout.value--;
}, 100);
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
      {{ `, ${(timeout / 10).toFixed(1)}` }}
    </span>
    <MaterialRipple v-if="timeout <= 0" />
  </button>
</template>

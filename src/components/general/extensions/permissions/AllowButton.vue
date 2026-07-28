<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed } from "vue";
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const properties = withDefaults(defineProps<{
  "idSuffix"?: string;
  "label"?   : string;
  "onClick"  : () => void;
}>(), {
  "idSuffix": "",
  "label"   : "Allow",
});

function elementId(element: string): string {
  const suffix = properties.idSuffix === "" ? "" : `-${properties.idSuffix}`;

  return `__extensions-loader__permission-request-${element}${suffix}`;
}

const buttonId = computed(() => elementId("allow-wrapper"));
const labelId = computed(() => elementId("allow-label"));
const timerId = computed(() => elementId("allow-timer-label"));

// No one wants to accidentally allow an extension permission
const timeout = ref<number>(15);

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
    :id="buttonId"
    data-permission-action="allow"
    @click="properties.onClick"
    class="group relative flex flex-nowrap rounded-md bg-neutral-800 px-3 py-1 transition-[opacity,background-color] disabled:bg-red-800 disabled:opacity-60"
  >
    <span
      :id="labelId"
      class="text-white transition-[color] group-disabled:text-red-300"
    >
      {{ properties.label }}
    </span>
    <span
      v-if="timeout > 0"
      :id="timerId"
      class="text-red-300"
    >
      {{ `, ${(timeout / 10).toFixed(1)}` }}
    </span>
    <MaterialRipple v-if="timeout <= 0" />
  </button>
</template>

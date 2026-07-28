<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { computed } from "vue";

import { globalStates } from "@/states/global.ts";

const { id, label, disabled, colors } = defineProps<{
  "id"      ?: string;
  "label"   ?: string;
  "disabled"?: boolean;
  "colors"  ?: {
    "ripple"  ?: string | null;
    "sparkles"?: string | null;
  };
}>();

const defaultColors = computed((): {
  "color"   : string | null;
  "sparkles": string | null;
} | undefined => {
  const { color, sparkles } = globalStates.ui.ripple;

  if (color || sparkles) {
    return { color, sparkles };
  }

  return undefined;
});
</script>

<template>
  <Ripple
    v-if="defaultColors"
    :id="id"
    :aria-label="label"
    :aria-hidden="true"
    :class="[disabled ? 'pointer-events-none' : '']"
    :ripple-color="colors?.ripple ?? defaultColors.color"
    :sparkles-color-r-g-b="colors?.sparkles ?? defaultColors.sparkles"
  />
</template>

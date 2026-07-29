<script setup lang="ts">
import { computed } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { globalStates } from "@/states/global.ts";

const filtering = computed((): string => globalStates?.logs?.filtering ?? "");

function handleInput(newValue: string): void {
  globalStates.logs.filtering = newValue;
}
</script>

<template>
  <CustomInput
    icon="i-lucide-list-filter"
    placeholder="Filter..."
    id-root="__log-controls__filter"
    :debounce-time="200"
    :default-value="filtering"
    :listen-to-events="true"
    :on-input="handleInput"
    :on-blur="handleInput"
  />
</template>

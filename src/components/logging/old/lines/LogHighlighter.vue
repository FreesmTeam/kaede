<script setup lang="ts">
import type { LogControlsType } from "@/types/logging/log-controls.type.ts";

const { searching, fields, occurrences, index, colorClass } = defineProps<{
  "searching"      : LogControlsType["searching"];
  "fields"         : Array<string>;
  "occurrences"    : Array<string>;
  "index"          : number;
  "colorClass"    ?: string;
}>();
</script>

<template>
  <span
    :id="`__log-highlighter__wrapper-${index}`"
    v-for="(element, occurrenceIndex) in occurrences"
    :key="`${element}-${occurrenceIndex}`"
    :class="[colorClass, 'whitespace-pre']"
  >
    <span :id="`__log-highlighter__non-highlighted-start-${index}`">
      {{ fields[occurrenceIndex] }}
    </span>
    <span
      :id="`__log-highlighter__highlighted-${index}`"
      :class="[
        (searching.currentIndex ?? 0) === index
          ? 'bg-pink-600 text-white'
          : 'bg-purple-400 text-black'
      ]"
    >
      {{ element }}
    </span>
  </span>
  <span :id="`__log-highlighter__non-highlighted-end-${index}`" :class="colorClass">
    {{ fields[fields.length - 1] }}
  </span>
</template>

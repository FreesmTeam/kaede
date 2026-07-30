<script setup lang="ts">
import { useTemplateRef } from "vue";

import LogEntry from "@/components/logging/lines/LogEntry.vue";
import type { LogControlsType } from "@/types/logging/log-controls.type.ts";

const target = useTemplateRef("target");

const { logs, searching, horizontalScroll } = defineProps<{
  "logs"            : Array<string | [number, string]>;
  "searching"       : LogControlsType["searching"];
  "horizontalScroll": boolean;
}>();

defineExpose({ "nonVirtualizedLogsTarget": target });
</script>

<template>
  <div
    :id="horizontalScroll ? '__non-virtualized-list-logs' : ''"
    ref="target"
    class="h-[calc(100vh-248px)] w-fit select-text"
  >
    <template
      v-for="(entry, index) in logs"
      :key="index"
    >
      <LogEntry
        :line="entry"
        :index="typeof entry === 'string'
          ? index
          : entry[0]"
        :searching="searching"
      />
    </template>
  </div>
</template>

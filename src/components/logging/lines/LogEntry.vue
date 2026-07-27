<script setup lang="ts">
import { computed } from "vue";

import LogHighlighter from "@/components/logging/lines/LogHighlighter.vue";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LogControlsType } from "@/types/logging/log-controls.type.ts";
import type { LogEntryInformationType } from "@/types/logging/log-entry-information.type.ts";
import type { FieldTextType } from "@/types/logging/log-field-text.type.ts";

/**
 * 'line' format:
 * time | level | target | message
 */
const { line, index, searching, selectionIndexes } = defineProps<{
  "line"             : string | [number, string];
  "index"            : number;
  "searching"        : LogControlsType["searching"];
  "selectionIndexes"?: [number, number] | undefined;
}>();

const information = computed((): LogEntryInformationType => Logging.getLogEntryInformation(line));
const extractedInformation = computed((): {
  "time"   : string | FieldTextType;
  "level"  : string | FieldTextType;
  "target" : string | FieldTextType;
  "message": string | FieldTextType;
} => {
  let safeSearching: string = searching.current;

  try {
    "".matchAll(new RegExp(searching.current, "g"));
  } catch (error: unknown) {
    const extractedError = Errors.extract(error);

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Couldn't parse the searching value",
      "(stacktrace is absent to avoid huge logs flooding):",
      extractedError.name + ":",
      extractedError.message,
    );
    safeSearching = "Invalid regular expression";
  }

  const time = Logging.getLogFieldText(information.value.time, safeSearching);
  const level = Logging.getLogFieldText(information.value.level, safeSearching);
  const target = Logging.getLogFieldText(information.value.target, safeSearching);
  const message = Logging.getLogFieldText(information.value.message, safeSearching);

  return { time, level, target, message };
});
const isInRange = computed((): boolean => {
  if (!selectionIndexes) {
    return false;
  }

  const rangeFirst = Number(selectionIndexes[0]);
  const rangeSecond = Number(selectionIndexes[1]);
  const rangeStart = Math.min(rangeFirst, rangeSecond);
  const rangeEnd = Math.max(rangeFirst, rangeSecond);

  return (
    (rangeStart <= index) &&
    (rangeEnd >= index)
  );
});
const shouldCollapseTarget: boolean = GlobalObject.variables.logs.targetCollapse;
const collapsedTargetLength: number = GlobalObject.variables.logs.collapsedTargetLength;
</script>

<template>
  <div
    :id="`__log-entry__wrapper-${index}`"
    :class="[
      '__log-entry__wrapper',
      isInRange && 'bg-indigo-950',
      'flex shrink-0 flex-nowrap gap-1 px-1',
    ]"
  >
    <p :id="`__log-entry__index-${index}`" class="__log-entry__index w-14 shrink-0 select-none text-center text-neutral-400">
      {{ index }}
    </p>
    <div :id="`__log-entry__text-wrapper-${index}`" class="__log-entry__text-wrapper break-all">
      <span
        :id="`__log-entry__time-${index}`"
        v-if="typeof extractedInformation.time === 'string'"
        class="__log-entry__time text-neutral-400"
      >
        {{ extractedInformation.time }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-400"
        :index="index"
        :fields="extractedInformation.time.fields"
        :occurrences="extractedInformation.time.extractions"
        :searching="searching"
      />
      {{ " " }}
      <span
        :id="`__log-entry__level-${index}`"
        v-if="typeof extractedInformation.level === 'string'"
        :class="[
          '__log-entry__level',
          extractedInformation.level !== ''
            && 'inline-block text-white w-5 text-center',
          Logging.getLogLevelColor(information.level),
        ]"
      >
        {{ extractedInformation.level[0] }}
      </span>
      <LogHighlighter
        v-else
        :color-class="Logging.getLogLevelColor(information.level)"
        :index="index"
        :fields="extractedInformation.level.fields"
        :occurrences="extractedInformation.level.extractions"
        :searching="searching"
      />
      {{ " " }}
      <span
        :id="`__log-entry__target-${index}`"
        v-if="typeof extractedInformation.target === 'string'"
        :class="['__log-entry__target', Logging.getLogTargetColor(information.target)]"
      >
        {{ shouldCollapseTarget && extractedInformation.target.length > 0
            ? `...${extractedInformation.target.slice(-1 * collapsedTargetLength)}`
            : extractedInformation.target }}
      </span>
      <LogHighlighter
        v-else
        :color-class="Logging.getLogTargetColor(information.target)"
        :index="index"
        :fields="extractedInformation.target.fields"
        :occurrences="extractedInformation.target.extractions"
        :searching="searching"
      />
      {{ " " }}
      <span
        :id="`__log-entry__message-${index}`"
        v-if="typeof extractedInformation.message === 'string'"
        :class="[
          '__log-entry__message',
          information.level === 'ERROR' ? 'text-red-300' : 'text-neutral-300',
        ]"
      >
        {{ extractedInformation.message }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-300"
        :index="index"
        :fields="extractedInformation.message.fields"
        :occurrences="extractedInformation.message.extractions"
        :searching="searching"
      />
    </div>
  </div>
</template>

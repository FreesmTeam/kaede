<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const { styles } = useConfigColors();

// On every new component mount, this will change (i.e., when page changes)
const randomIndex = Math.floor(Math.random() * globalStates.ui.atAGlance.length);

const target = useTemplateRef<HTMLDivElement>("target");

const editing = ref<keyof GlobalStatesType["ui"]["atAGlance"][number] | undefined>(undefined);

const currentGlance = computed((): GlobalStatesType["ui"]["atAGlance"][number] => {
  return globalStates.ui.atAGlance[randomIndex];
});

/*
 * Previously, this function was debounced as it triggered updates
 * of a field at 'globalStates'. Since at that time global states were
 * simply a 'shallowReactive' object, all other fields in the 'ui' field
 * were changed as well, triggering extension hooks and Vue reactivity system
 */
const handleEdit = (event: Event, field: "title" | "subtitle"): void => {
  const target = event?.target as (HTMLInputElement | undefined);
  const value: string | undefined = target?.value;

  if (value === undefined) {
    return;
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Setting the global 'At a Glance - ${field}' value to: ${value}`,
  );
  globalStates.ui.atAGlance[randomIndex][field] = value;
};

onClickOutside(target, () => {
  editing.value = undefined;
});

function transformInput(input: string): string {
  const currentDate = (new Date)
    .toDateString()
    .split(" ");

  return input
    .replace(/%date%/g, (
      currentDate[0] + ", " + currentDate[1] + " " + currentDate[2]
    ))
    .replace(/%.*?%/g, (value: string): string => {
      // Only allow evaluation of custom placeholders if user has enabled unrestricted extensions
      if (!globalStates.extensions.allowUnrestrictedUntrusted) {
        return value;
      }

      try {
        const clean: string = value.slice(1, -1);
        const evaluate = new Function(`return ${clean};`);

        return evaluate();
      } catch {
        return value;
      }
    });
}
</script>

<template>
  <div
    id="__home-page__header-wrapper"
    ref="target"
    class="flex flex-col gap-1 pt-4"
  >
    <div
      id="__home-page__header-title"
      @click="() => editing = 'title'"
      class="relative w-fit cursor-pointer break-all border border-transparent rounded-md p-2 text-3xl leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      <p
        id="__home-page__header-title-text"
        class="whitespace-pre-wrap"
        :style="styles.text"
      >
        {{ transformInput(currentGlance.title) }}
      </p>
      <Transition name="pop">
        <input
          v-if="editing === 'title'"
          @input="event => handleEdit(event, 'title')"
          :value="currentGlance.title"
          autocomplete="off"
          id="__home-page__header-title-editor-wrapper"
          class="absolute left-0 top-13 z-10 min-w-96 rounded-md bg-neutral-950 p-1 text-lg leading-none outline-none focus:outline-none"
      />
      </Transition>
    </div>
    <div
      id="__home-page__header-subtitle"
      @click="() => editing = 'subtitle'"
      class="relative w-fit cursor-pointer break-all border border-transparent rounded-md p-2 text-lg leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      <p
        id="__home-page__header-subtitle-text"
        class="whitespace-pre-wrap"
        :style="styles.textSecondary"
      >
        {{ transformInput(currentGlance.subtitle) }}
      </p>
      <Transition name="pop">
        <input
          v-if="editing === 'subtitle'"
          @input="event => handleEdit(event, 'subtitle')"
          :value="currentGlance.subtitle"
          autocomplete="off"
          id="__home-page__header-subtitle-editor-wrapper"
          class="absolute left-0 top-10 z-10 min-w-96 rounded-md bg-neutral-950 p-1 text-lg leading-none outline-none focus:outline-none"
        />
      </Transition>
    </div>
  </div>
</template>

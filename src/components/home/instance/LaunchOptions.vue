<script setup lang="ts">
import { computed, type ComputedRef, inject, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  LaunchInstanceContextKey,
  LaunchInstanceStatusesContextKey,
  LaunchOptionItems,
} from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";

const launchInstance = inject<LaunchContextType>(LaunchInstanceContextKey);
const launchStatuses = inject<{
  "launchable" : ComputedRef<boolean>;
  "unstoppable": ComputedRef<boolean>;
}>(LaunchInstanceStatusesContextKey);

const unlaunchable = computed((): boolean => (
  !launchStatuses?.launchable?.value
));

const opened = ref<boolean>(false);
const disabled = ref<Set<string>>(new Set);

function toggleOptions(event: PointerEvent): void {
  // '0' means a left click
  if (event.button !== 0) {
    return;
  }

  opened.value = !opened.value;
}

function wrapAction(item: (typeof LaunchOptionItems)[number], event: MouseEvent): void {
  if (launchInstance === undefined) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "The injected 'launchInstance' function is undefined. What happened lol",
    );
  }

  const instance = Instances.findCurrent(globalStates?.selected?.currentInstance);

  if (instance === undefined) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "The found 'instance' is undefined. What happened lol",
    );
  }

  disabled.value.add(item.label);
  opened.value = false;

  void ActionRegistry
    .execute(item.action, { event, item, instance, "launch": launchInstance })
    .then(() => {
      disabled.value.delete(item.label);
    })
    .catch(error => {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `An error occurred with '${item.action}':`,
        Errors.prettify(error),
      );
      disabled.value.delete(item.label);
    });
}
</script>

<template>
  <div
    id="__home-page__launch-options-wrapper"
    class="relative"
  >
    <button
      id="__home-page__launch-options-button"
      @pointerdown="toggleOptions"
      :class="[
        opened ? 'cursor-default bg-neutral-300' : 'bg-white',
        'relative h-full w-fit rounded-l-sm rounded-r-md px-1 py-2 text-black',
        'transition-[background-color]',
      ]"
      >
      <span
        id="__home-page__launch-options-icon"
        :class="[
          opened ? 'rotate-180' : 'rotate-0',
          'i-lucide-chevron-down block transition-[transform]',
        ]"
      ></span>
      <MaterialRipple
        :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
      />
    </button>
    <Transition name="slide-up">
      <div
        v-show="opened"
        id="__home-page__launch-options-dropdown"
        class="absolute bottom-12 right-0 flex flex-col rounded-md bg-white py-1"
      >
        <button
          v-for="item in LaunchOptionItems"
          :key="item.label"
          :disabled="disabled.has(item.label) || unlaunchable"
          :id="`__home-page__launch-options-dropdown-item-${item.label}`"
          @click="event => wrapAction(item, event)"
          class="px-2 py-1 text-start text-nowrap text-sm text-black hover:bg-neutral-300 disabled:opacity-70"
        >
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

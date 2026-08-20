<script setup lang="ts">
import { ask } from "@tauri-apps/plugin-dialog";
import { useIntervalFn } from "@vueuse/core";
import { computed, type ComputedRef, inject, provide, ref, watchEffect } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  CloseInstanceContextKey,
  LaunchInstanceContextKey, LaunchInstanceStatusesContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import Fetching from "@/lib/launcher/scopes/fetching";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type {
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const killing = ref<boolean>(false);

const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);
const launchInstance = inject<LaunchContextType>(
  LaunchInstanceContextKey,
);
const closeInstance = inject<(instanceId: string) => Promise<void>>(
  CloseInstanceContextKey,
);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.selected?.currentInstance)
));
const statuses = computed((): LauncherStatusesType | undefined => {
  const instanceId: string | undefined = currentInstance?.value?.id;

  if (
    instanceId === undefined ||
    instanceStatuses === undefined
  ) {
    return undefined;
  }

  return instanceStatuses[instanceId];
});
const isDownloading = computed((): boolean => {
  return (
    statuses.value?.launching === 1 &&
    (statuses.value?.downloads?.total ?? 0) > 0
  );
});

/*
 * This state handles the launching button and acts as a 'disabled' attribute
 * not only for the launch buttons but for LaunchOptions.vue as well
 */
const launchable = computed((): boolean => (
  // Pretty simple: if the instance is not launching and not launched, then we can launch it
  statuses.value === undefined || statuses.value?.launching === 0
));
// This state handles the stopping button and acts as a 'disabled' attribute
const unstoppable = computed((): boolean => (
  // If the 'killing' is already in the process, then the button is untouchable
  killing.value ||

  /*
   * Or, if the instance is not launched and the download tasks are empty, then untouchable too:
   * - download tasks can be cancelled;
   * - launched instance can be killed.
   * When the instance is launched, it implies that the download tasks are done.
   * When the download tasks are in the process, it implies that the instance is not launched.
   * Wait, I just repeated myself with P => Q === not(Q) => not(P), but alright??
   *
   * Hold on, can we simplify this?
   * 'launching' can be in three states: none (0 | undefined), launching (1), and launched (2).
   * 'isDownloading' can either be true or false, and it implies that the 'launching'
   * is definitely not '2'. Wait, but it also must imply that the 'launching' is not '0 | undefined'
   * since download tasks only happen when the instance is being launched (1).
   * Whoa, so we can really simplify this? Also, I am a fucking dumb ass since I just could
   * glance at the definition of 'isDownloading' and see there 'statuses.value?.launching === 1'.
   * Hmm wait, what the fuck is going on here. So, if not downloading, then disabled?
   * HOLD ON, if not downloading but is launched ('true && false'), then it is not disabled
   * since WE MUST BE ABLE TO KILL THE MINECRAFT PROCESS.
   * Ohhh, that's why I also wrote 'statuses.value?.launching !== 2' before
   */
  (!isDownloading.value && statuses.value?.launching !== 2)
));

function handleLaunch(): void {
  if (launchInstance === undefined) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The injected 'launchInstance' function is undefined. What happened lol",
    );

    return;
  }

  const instanceId: string | undefined = currentInstance?.value?.id;
  const instanceContent: InstanceStateType | undefined = currentInstance?.value?.instance;

  launchInstance(instanceId)
    .then(() => {
      if (!instanceId || !instanceContent) {
        return log.error(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
          "The instance ID or data is invalid. Provided contents",
          { instanceId, instanceContent },
        ));
      }

      instanceStates[instanceId] = {
        ...instanceStates[instanceId],
        "lastLaunch": Date.now(),
      };
    });
}
async function handleClose(): Promise<void> {
  const toClose: boolean = await ask(
    "Do you really want to cancel the Minecraft launch?",
    "Minecraft",
  );

  if (!toClose) {
    return;
  }

  const instanceId: string | undefined = currentInstance?.value?.id;

  if (instanceId === undefined) {
    return log.error(__PRE_BUNDLED_FILENAME__, "The current instance id is undefined");
  }

  if (isDownloading.value) {
    await Fetching.cancelAll(`${instanceId}-download`);

    return;
  }

  if (closeInstance === undefined) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "The injected 'closeInstance' function is undefined. What happened lol",
    );
  }

  try {
    killing.value = true;

    await closeInstance(instanceId);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not close the instance process:",
      Errors.prettify(error),
    );
  }

  killing.value = false;
}

watchEffect((): void => {
  const launchingInstance: boolean = statuses.value?.launching === 1;
  const killingInstance: boolean = killing.value;

  document.body.style.cursor = (launchingInstance || killingInstance)
    ? "progress"
    : "";
});

const previousIntervalTime = ref<number>(Date.now());

useIntervalFn((): void => {
  if (statuses.value?.launching === 2) {
    const currentId: string | undefined = currentInstance.value?.id;
    const currentInstanceContent: InstanceStateType | undefined = currentInstance.value?.instance;
    const currentPlayTime: number | undefined = currentInstanceContent?.playTime;

    // 'currentTime' might be zero
    if (!currentId || !currentInstanceContent || currentPlayTime === undefined) {
      return;
    }

    const currentAbsoluteTime: number = Date.now();
    const previousAbsoluteTime: number = previousIntervalTime.value;
    const timeToAdd: number = currentAbsoluteTime - previousAbsoluteTime;

    instanceStates[currentId] = {
      ...instanceStates[currentId],
      "playTime": currentPlayTime + timeToAdd,
    };

    previousIntervalTime.value = currentAbsoluteTime;
  }
}, 1000);

provide<{
  "launchable" : ComputedRef<boolean>;
  "unstoppable": ComputedRef<boolean>;
}>(LaunchInstanceStatusesContextKey, { launchable, unstoppable });

// Expose the 'instanceStatuses' so that 'declare-action-registry.ts' can use it
watchEffect(() => {
  if (instanceStatuses) {
    GlobalInternals.logs.instanceStatuses = instanceStatuses;
  }
});
</script>

<template>
  <button
    v-if="launchable"
    @click="handleLaunch"
    id="__home-page__launch-button"
    class="relative min-w-24 rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Launch
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
  <button
    v-else
    @click="handleClose"
    id="__home-page__launch-abort-button"
    :disabled="unstoppable"
    class="relative min-w-24 rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Stop
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
      :disabled="unstoppable"
    />
  </button>
  <slot />
</template>

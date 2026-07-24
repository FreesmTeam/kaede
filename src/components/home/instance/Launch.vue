<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, inject, ref, watchEffect } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  CloseInstanceContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import Fetching from "@/lib/launcher/scopes/fetching";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type {
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const killing = ref<boolean>(false);
const cancelling = ref<boolean>(false);

const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);
const launchInstance = inject<(instanceId?: string) => Promise<void>>(
  LaunchInstanceContextKey,
);
const closeInstance = inject<(instanceId: string) => Promise<void>>(
  CloseInstanceContextKey,
);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
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
  return Fetching.isDownloadCancellationActive(statuses.value);
});
const closeDisabled = computed((): boolean => {
  return (
    (!isDownloading.value && statuses.value?.launching !== 2) ||
    killing.value ||
    cancelling.value
  );
});

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

      Instances.change(instanceId, {
        ...instanceContent,
        "lastLaunch": Date.now(),
      });
    });
}
async function handleClose(): Promise<void> {
  let toClose: boolean;

  try {
    toClose = await Host.dialogs.ask({
      "message": "Do you really want to cancel Minecraft launch?",
      "title"  : "Cancel Minecraft launch",
      "kind"   : "warning",
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not ask for Minecraft launch cancellation confirmation:",
      Errors.prettify(error),
    );

    return;
  }

  if (!toClose) {
    return;
  }

  const instanceId: string | undefined = currentInstance?.value?.id;

  if (instanceId === undefined) {
    return log.error(__PRE_BUNDLED_FILENAME__, "The current instance id is undefined");
  }

  if (isDownloading.value) {
    try {
      cancelling.value = true;

      await Fetching.cancelAll(Fetching.getDownloadCancelId(instanceId));
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Could not cancel the instance downloads:",
        Errors.prettify(error),
      );
    } finally {
      cancelling.value = false;
    }

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
  } finally {
    killing.value = false;
  }
}

watchEffect((): void => {
  const launchingInstance: boolean = statuses.value?.launching === 1;
  const closingInstance: boolean = killing.value || cancelling.value;

  document.body.style.cursor = (launchingInstance || closingInstance)
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

    Instances.change(currentId, {
      ...currentInstanceContent,
      "playTime": currentPlayTime + timeToAdd,
    });

    previousIntervalTime.value = currentAbsoluteTime;

    if (instanceStates) {
      Instances.syncMetadata(instanceStates);
    }
  }
}, 2000);
</script>

<template>
  <button
    @click="handleLaunch"
    :disabled="statuses?.launching === 1 || statuses?.launching === 2"
    id="__home-page__launch-button"
    class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Launch
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
      :disabled="statuses?.launching === 1 || statuses?.launching === 2"
    />
  </button>
  <button
    @click="handleClose"
    id="__home-page__launch-abort-button"
    :disabled="closeDisabled"
    class="relative w-fit rounded-sm bg-white px-1 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-abort-icon"
      class="i-lucide-x block"
    ></span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
      :disabled="closeDisabled"
    />
  </button>
</template>

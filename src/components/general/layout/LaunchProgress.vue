<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, inject, ref } from "vue";

import {
  LaunchStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const progressLimit: number = 90;

const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);
const Translations = inject<TranslationsStateType>(TranslationsContextKey);

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

const currentDownloadSpeed = ref<string>("0");

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
const progress = computed<number>((oldValue: number | undefined): number => {
  if (statuses.value === undefined || statuses.value.launching === 0) {
    return 0;
  }

  if (!oldValue) {
    return statuses.value.current === LaunchStatus.General.Starting
      ? 10
      : (
        statuses.value.current === LaunchStatus.General.Success
          ? 100
          : 0
      );
  }

  switch (statuses.value.current) {
    case LaunchStatus.General.Starting: {
      return 10;
    }
    case LaunchStatus.PatchIndex.Success:
    case LaunchStatus.PatchMetadata.Success:
    case LaunchStatus.AssetIndex.Success:
    case LaunchStatus.AssetObjects.Success:
    case LaunchStatus.Libraries.Success:
    case LaunchStatus.Logging.Success:
    case LaunchStatus.Client.Success: {
      return Math.min(oldValue + 15, progressLimit);
    }
    case LaunchStatus.General.Success: {
      return 100;
    }
    default: {
      return oldValue;
    }
  }
});

useIntervalFn(() => {
  const currentDownloads: MapIterator<[number, number]> | undefined =
    statuses.value?.downloads?.current?.values?.();

  if (!currentDownloads) {
    return;
  }

  const divider: number = 1024 * 1024;
  let totalSpeed: number = 0;

  for (const [, speed] of currentDownloads) {
    totalSpeed += speed;
  }

  currentDownloadSpeed.value = (totalSpeed / divider).toFixed(2);
  // Updates 10 times a second
}, 100);
</script>

<template>
  <div
    v-if="statuses?.downloads"
    id="__layout__launch-progress-downloads-count"
    class="absolute right-2 top-2 z-10 flex flex-col items-end gap-1 rounded-md p-2 leading-none opacity-60"
    :style="cardStyles"
  >
    <div
      v-if="currentDownloadSpeed !== '0.00'"
      id="__layout__launch-progress-current-speed"
      class="text-sm"
    >
      {{ currentDownloadSpeed }} MB/s
    </div>
    <div
      v-if="statuses.downloads.current.size > 0"
      id="__layout__launch-progress-current-downloads"
      class="text-sm"
    >
      Downloading {{ statuses.downloads.current.size }} objects
    </div>
    <div
      v-if="statuses.downloads.total > 0"
      id="__layout__launch-progress-downloads-info"
      class="text-sm"
    >
      Finished {{ statuses.downloads.success }} out of {{ statuses.downloads.total }}
    </div>
    <div
      v-if="statuses.downloads.failed > 0"
      id="__layout__launch-progress-failed-downloads"
      class="text-sm text-red-300"
    >
      Failed to download {{ statuses.downloads.failed }} objects
    </div>
    <div
      v-if="statuses.current"
      id="__layout__launch-progress-current-status"
    >
      {{ Translations?.Messages?.[`general.launch-status.${statuses.current}`] }}
    </div>
  </div>
  <div
    v-if="progress > 0"
    id="__layout__launch-progress-bar-text"
    class="absolute bottom-0 left-[-50%] z-6500 block h-1 w-full rounded-r-md bg-white transition-[transform]"
    :style="{
        transform: `scaleX(${progress * 2}%)`,
      }"
  ></div>
</template>

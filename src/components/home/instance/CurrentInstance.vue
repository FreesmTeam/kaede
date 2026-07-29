<script setup lang="ts">
import { computed, ref } from "vue";

import Dropdown from "@/components/general/base/Dropdown.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { Patches } from "@/constants/meta.ts";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type { DropdownItemType } from "@/types/ui/dropdown-item.type.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const selector = ref<boolean>(false);
const syncing = ref<boolean>(false);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

function openInstancesSelector(): void {
  selector.value = true;
}
function closeInstancesSelector(event?: Event): void {
  const target: EventTarget | null | undefined = event?.target;

  if (
    target &&
    ("id" in target) &&
    target.id === "__home-page__instance-section-wrapper"
  ) {
    return;
  }

  selector.value = false;
}

async function selectInstance(id: string, layout: GlobalStatesType["layout"]): Promise<void> {
  syncing.value = true;

  try {
    GlobalStateHelpers.change("layout", {
      ...layout,
      "currentInstance": id,
    });
    closeInstancesSelector();

    await Configs.sync();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not select the instance:",
      Errors.prettify(error),
    );
  }

  syncing.value = false;
}

const dropdownItems = computed((): Array<DropdownItemType> => {
  if (instanceStates === undefined || globalStates === undefined) {
    return [];
  }

  const instances: Array<[string, InstanceStateType]> = Object.entries(instanceStates);
  const currentId: string | undefined = currentInstance.value?.id;

  return instances.map(([id, instance]) => {
    return {
      "id"      : `__home-page__current-instance-${id}`,
      "image"   : instance.icon,
      "onclick" : (): Promise<void> => selectInstance(id, globalStates.layout),
      "title"   : instance.name,
      "subtitle": instance.patchVersions?.[Patches.Minecraft] ?? "unknown version",
      "disabled": id === currentId,
    };
  });
});
</script>

<template>
  <Dropdown
    id="__home-page__current-instance-dropdown"
    add-class-names="absolute bottom-16 z-50"
    size-class-names="max-h-85 w-full"
    :shown="selector"
    :close="closeInstancesSelector"
    :items="dropdownItems"
  />
  <button
    :disabled="syncing"
    @pointerdown="openInstancesSelector"
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color,opacity] active:cursor-default hover:bg-[theme(colors.neutral.100/.05)]"
  >
    <Image
      v-if="currentInstance"
      id="__home-page__current-instance-logo"
      class-names="object-cover rounded-md size-12 p-1"
      :src="currentInstance.instance.icon"
      :alt="`${currentInstance.instance.name}'s icon`"
    />
    <span
      v-else
      id="__home-page__current-instance-missing-logo"
      class="m-1 block size-10 rounded-md bg-neutral-500"
    ></span>
    <span
      id="__home-page__current-instance-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-instance-information-title"
        class="block font-medium"
      >
        {{ currentInstance?.instance?.name ?? "Unknown" }}
      </span>
      <span
        id="__home-page__current-instance-information-version"
        class="block text-neutral-400"
      >
        {{
          currentInstance?.instance?.patchVersions?.[Patches.Minecraft]
            ?? "Click here to select an instance"
        }}
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>

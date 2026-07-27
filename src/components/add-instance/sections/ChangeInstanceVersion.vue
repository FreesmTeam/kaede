<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";

import ChangeInstanceVersionDropdown
  from "@/components/add-instance/sections/ChangeInstanceVersionDropdown.vue";
import CustomInput from "@/components/general/base/CustomInput.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { Patches } from "@/constants/meta.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const target = useTemplateRef("target");

const currentFilter = ref<"release" | "all">("release");
const selector = ref<boolean>(false);

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.states?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));

function toggleTypeFilter(): void {
  currentFilter.value = currentFilter.value === "release"
    ? "all"
    : "release";
}
function handleDropdown(isOpen: boolean, event?: PointerEvent): void {
  const target = event?.target as HTMLButtonElement | undefined;

  if (target?.id === "__add-instance-page__instance-version-dropdown-wrapper") {
    return;
  }

  selector.value = isOpen;
}
function handleVersionSearch(input: string): void {
  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instanceVersionSearch": {
      "patch": Patches.Minecraft,
      ...currentVersionSearch.value,
      input,
    },
  });
}

onClickOutside(target, () => handleDropdown(false));
</script>

<template>
  <div
    ref="target"
    id="__add-instance-page__instance-version"
    class="relative flex flex-nowrap gap-2 rounded-md p-2"
  >
    <div
      v-if="currentInstance?.patchVersions?.[Patches.Minecraft]"
      id="__add-instance-page__instance-version-selected-badge"
      class="grid place-items-center rounded-md px-2 text-neutral-400 leading-none bg-[theme(colors.neutral.100/.1)]"
      :data-tooltip="`Selected version of '${Patches.Minecraft}'`"
    >
      {{ currentInstance.patchVersions[Patches.Minecraft] }}
    </div>
    <div
      v-if="currentPatch !== Patches.Minecraft && currentInstance?.patchVersions?.[currentPatch]"
      id="__add-instance-page__instance-version-selected-badge"
      class="grid h-full place-items-center rounded-md px-2 text-neutral-400 leading-none bg-[theme(colors.neutral.100/.1)]"
      :data-tooltip="`Selected version of '${currentPatch}'`"
    >
      {{ currentInstance.patchVersions[currentPatch] }}
    </div>
    <CustomInput
      icon="i-lucide-search"
      id-root="__add-instance-page__instance-version"
      type="text"
      :placeholder="`Version of '${currentPatch}'`"
      :tooltip="`Searching for this version of '${currentPatch}'...`"
      :debounce-time="300"
      :default-value="currentVersionSearch?.input"
      :on-input="handleVersionSearch"
      :on-escape="() => handleDropdown(false)"
      @click="() => handleDropdown(true)"
      :class-names="{ 'wrapper': 'h-8 flex-1' }"
    />
    <button
      v-if="currentPatch === Patches.Minecraft"
      id="__add-instance-page__instance-version-selected-filter"
      class="relative grid min-w-20 place-items-center rounded-md px-2 leading-none bg-[theme(colors.neutral.100/.1)]"
      @click="toggleTypeFilter"
    >
      {{ currentFilter }}
      <MaterialRipple />
    </button>
    <Transition name="slide-up">
      <ChangeInstanceVersionDropdown
        v-if="selector"
        :handle-dropdown="handleDropdown"
        :current-filter="currentFilter"
      />
    </Transition>
  </div>
</template>

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
import { computed } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { Patches } from "@/constants/meta.ts";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const customSettings = computed(
  (): GlobalStatesType["pages"]["add-instance"]["customSettings"] => (
    globalStates?.pages?.["add-instance"]?.customSettings
  ),
);
</script>

<template>
  <div id="__add-instance-page__instance-other-custom-wrapper" class="h-fit w-full flex flex-col gap-2">
    <div
      id="__add-instance-page__instance-other-custom-title"
      class="relative rounded-md p-2"
    >
      <p
        id="__add-instance-page__instance-other-custom-title-label"
        class="h-8 flex items-center pl-1 leading-none"
      >
        Custom
      </p>
    </div>
    <div
      v-for="(option, index) in customSettings"
      :id="`__add-instance-page__instance-other-custom-option-${index}`"
      :key="index"
      class="relative rounded-md p-2"
    >
      <p
        v-if="option?.label"
        :id="`__add-instance-page__instance-other-custom-option-label-${index}`"
        class="h-8 flex items-center pl-1 leading-none"
      >
        {{ option.label }}
      </p>
      <CustomInput
        v-if="option?.input"
        :icon="option.input.iconClassName"
        :placeholder="option.input.placeholder"
        :id-root="`__add-instance-page__instance-other-custom-option-input-${index}`"
        :type="option.input?.type ?? 'text'"
        :tooltip="option.input.tooltip"
        :debounce-time="option.input?.debounceTime ?? 300"
        :default-value="option.input?.defaultValue?.()"
        :on-input="value => option.input?.onInput?.(value, currentInstance, currentPatch)"
        :on-blur="value => option.input?.onInput?.(value, currentInstance, currentPatch)"
        :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
      />
    </div>
  </div>
</template>

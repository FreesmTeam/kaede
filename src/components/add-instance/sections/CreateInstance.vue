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

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const { styles } = useConfigColors();

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
</script>

<template>
  <div
    id="__add-instance-page__create-instance-wrapper"
    class="w-fit flex flex-nowrap gap-2 rounded-md p-2"
  >
    <button
      id="__add-instance-page__create-instance-button"
      class="relative rounded-md px-2 py-1 bg-[theme(colors.neutral.100/.1)]"
      @click="() => Instances.create(currentInstance, currentPatch)"
    >
      Create an Instance
      <MaterialRipple />
    </button>
    <div
      id="__add-instance-page__create-instance-type-display"
      class="py-1 pr-2"
      :style="styles.widgetSecondary"
    >
      with {{ PrettyPatchLabels[currentPatch] }}
    </div>
  </div>
</template>

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

import ChangeCustomOptions from "@/components/add-instance/sections/ChangeCustomOptions.vue";
import ChangeInstanceGroups from "@/components/add-instance/sections/ChangeInstanceGroups.vue";
import ChangeInstanceIcon from "@/components/add-instance/sections/ChangeInstanceIcon.vue";
import ChangeInstanceName from "@/components/add-instance/sections/ChangeInstanceName.vue";
import ChangeInstancePatch from "@/components/add-instance/sections/ChangeInstancePatch.vue";
import ChangeInstanceResolution
  from "@/components/add-instance/sections/ChangeInstanceResolution.vue";
import ChangeInstanceVersion from "@/components/add-instance/sections/ChangeInstanceVersion.vue";
import ChangeJavaBinary from "@/components/add-instance/sections/ChangeJavaBinary.vue";
import ChangeMemoryAllocation from "@/components/add-instance/sections/ChangeMemoryAllocation.vue";
import CreateInstance from "@/components/add-instance/sections/CreateInstance.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { globalStates } from "@/states/global.ts";

const expanded = computed(
  (): boolean => (
    globalStates?.pages?.["add-instance"]?.full === true
  ),
);
const { styles } = useConfigColors();

function toggleOtherOptions(): void {
  globalStates.pages["add-instance"].full = !expanded.value;
}
</script>

<template>
  <div
    id="__add-instance-page__instance-wrapper"
    class="h-fit w-full flex flex-col gap-2 rounded-md p-2"
    :style="styles.widget"
  >
    <div
      id="__add-instance-page__instance-main-group"
      class="flex flex-nowrap gap-2"
    >
      <ChangeInstanceIcon />
      <div
        id="__add-instance-page__instance-general-wrapper"
        class="w-full flex flex-col gap-2"
      >
        <ChangeInstanceName />
        <ChangeInstanceGroups />
      </div>
    </div>
    <ChangeInstancePatch />
    <ChangeInstanceVersion />
    <div
      id="__add-instance-page__other-group-expander"
      class="relative flex flex-nowrap justify-between rounded-md p-2"
    >
      <p
        id="__add-instance-page__other-group-expander-label"
        class="h-8 flex items-center pl-1 leading-none"
      >
        Other options
      </p>
      <button
        id="__add-instance-page__other-group-expander-toggle"
        class="relative rounded-md p-2 leading-none bg-[theme(colors.neutral.100/.1)]"
        @click="toggleOtherOptions"
      >
        <span
          id="__add-instance-page__other-group-expander-toggle-icon"
          :class="[
            expanded ? 'rotate-90' : 'rotate-0',
            'i-lucide-chevron-right block size-4 transition-[transform]',
          ]"
        ></span>
        <MaterialRipple />
      </button>
    </div>
    <div
      v-if="expanded"
      id="__add-instance-page__instance-others-group"
      class="flex flex-wrap gap-2 sm:flex-nowrap"
    >
      <ChangeInstanceResolution />
      <div
        id="__add-instance-page__instance-other-settings-wrapper"
        class="lg:flex-2 flex flex-1 flex-col gap-2"
      >
        <ChangeMemoryAllocation />
        <ChangeJavaBinary />
      </div>
    </div>
    <!-- We need to always render this element since plugins will embed there -->
    <ChangeCustomOptions v-show="expanded" />
    <CreateInstance />
  </div>
</template>

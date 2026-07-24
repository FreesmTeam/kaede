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
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);

function handleJavaProgram(value: string): void {
  if (!currentInstance.value) {
    return;
  }

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "javaBinary": value,
    },
  });
}
</script>

<template>
  <div
    id="__add-instance-page__instance-other-java-binary-title"
    class="relative rounded-md p-2"
  >
    <p
      id="__add-instance-page__instance-other-java-binary-title-label"
      class="h-8 flex items-center pl-2 text-neutral-400 leading-none"
    >
      Launch program
    </p>
  </div>
  <div
    id="__add-instance-page__instance-other-java-binary"
    class="relative rounded-md p-2"
  >
    <CustomInput
      icon="i-lucide-coffee"
      placeholder="A program name of the Java binary path"
      id-root="__add-instance-page__instance-other-java-binary"
      type="text"
      tooltip="A program name of the Java binary path"
      :debounce-time="300"
      :default-value="currentInstance?.javaBinary"
      :on-input="handleJavaProgram"
      :on-blur="handleJavaProgram"
      :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
    />
  </div>
</template>
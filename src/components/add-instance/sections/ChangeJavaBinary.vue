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
import { computed, onMounted } from "vue";

import CustomSelect from "@/components/general/base/CustomSelect.vue";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";
import { javaStates } from "@/states/java.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(
      globalStates.pages?.["add-instance"]?.instance,
      globalStates.minecraft,
    )
  ),
);
const options = computed((): Array<{
  "id"   : string;
  "label": string;
}> => {
  const available = javaStates
    .installations
    .map(({ vendor, version, path }) => ({
      "id"   : path,
      "label": `${vendor} ${version}`.trim(),
    }));

  if (javaStates.environment !== null) {
    available.unshift({
      "id"   : javaStates.environment.path,
      "label": `java (${javaStates.environment.vendor} ${javaStates.environment.version})`.trim(),
    });
  }

  return available;
});

function handleJavaProgram(value: {
  "id"   : string;
  "label": string;
}): void {
  if (!currentInstance.value) {
    return;
  }

  globalStates.pages["add-instance"].instance = {
    ...currentInstance.value,
    "javaBinary": value.id,
  };
}

onMounted(() => {
  void Launcher.detectJavaInstallations();
});
</script>

<template>
  <div
    id="__add-instance-page__instance-other-java-binary-title"
    class="relative rounded-md p-2"
  >
    <p
      id="__add-instance-page__instance-other-java-binary-title-label"
      class="h-8 flex items-center pl-1 leading-none"
    >
      Launch program
    </p>
  </div>
  <div
    id="__add-instance-page__instance-other-java-binary"
    class="relative rounded-md p-2"
  >
    <CustomSelect
      id-root="__add-instance-page__instance-other-java-binary"
      :options="options"
      :value="currentInstance?.javaBinary"
      :on-select="handleJavaProgram"
      :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
    />
  </div>
</template>

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

import DisplayLogs from "@/components/logging/wrappers/DisplayLogs.vue";
import { useLogStream } from "@/composables/use-log-stream.ts";
import { globalStates } from "@/states/global.ts";

const { "lines": raw } = useLogStream();

const logs = computed((): Array<string> => {
  const filtering: string = globalStates.logs.filtering;

  if (filtering === "") {
    return raw.value.list;
  }

  const filtered: Array<string> = [];

  for (const line of raw.value.list) {
    filtered.push(line);
  }

  return filtered;
});
</script>

<template>
  <div
    @contextmenu.prevent
    id="__log-viewer__wrapper"
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 flex items-start p-16 text-start text-sm bg-[theme(colors.black/.5)]"
    v-show="logs.length > 0"
  >
    <div
      id="__log-viewer__inner"
      class="w-full flex-1 select-text"
    >
      <DisplayLogs :logs="logs" />
    </div>
  </div>
</template>

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
import { inject, type ShallowReactive } from "vue";

import {
  ApplicationName,
  InstanceLogsContextKey,
} from "@/constants/application.ts";
import Configs from "@/lib/configs";
import { globalStates } from "@/states/global.ts";

const instanceLogs = inject<ShallowReactive<Record<string, string[]>>>(InstanceLogsContextKey);

async function handleModeSelect(event: Event): Promise<void> {
  const target = event.target as HTMLSelectElement | null;
  const newValue: string | undefined = target?.value;

  if (newValue === undefined) {
    return;
  }

  // GlobalStateHelpers.Logs.selectMode(newValue);

  return Configs.sync();
}
</script>

<template>
  <span id="__log-viewer__information-subtitle-static">
    View
    <select
      id="__log-viewer__information-subtitle-mode-selector"
      class="rounded-md text-sm"
      @change="handleModeSelect"
      :value="globalStates?.logs?.mode"
    >
      <option value="launcher">
        {{ ApplicationName }}
      </option>
      <option
        v-for="logKey in Object.keys(instanceLogs ?? {})"
        :key="logKey"
        :value="logKey"
      >
        {{ logKey }}
      </option>
    </select>
    logs
  </span>
</template>

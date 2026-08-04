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
import { useIntervalFn } from "@vueuse/core";
import { ref } from "vue";

import DevelopmentMode from "@/lib/development-mode";

const usage = ref<string>("...");

useIntervalFn(async () => {
  usage.value = await DevelopmentMode.getCpuUsage();
}, 1000);
</script>

<template>
  <div
    id="__dev-cpu-usage__wrapper"
    class="flex flex-1 flex-col items-end gap-2 bg-black p-2 opacity-50"
  >
    <div
      id="__dev-cpu-usage__inner"
      class="w-full flex flex-nowrap items-center justify-start gap-2 text-sm text-white font-mono"
    >
      <span id="__dev-cpu-usage__icon" class="i-lucide-cpu block size-4"></span>
      {{ usage }}%
    </div>
  </div>
</template>

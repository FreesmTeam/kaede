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
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { computed, ref } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type { LogLineType } from "@/types/logging/log-line.type.ts";

const status = ref<"none" | "pending" | "success">("none");
const icon = computed((): string => {
  if (status.value === "none") {
    return "i-lucide-copy";
  }

  if (status.value === "pending") {
    return "i-lucide-loader";
  }

  return "i-lucide-check";
});

async function copy(): Promise<void> {
  const logs: Array<LogLineType> | undefined = GlobalInternals.logs.filtered?.value?.list;

  if (!logs) {
    return;
  }

  status.value = "pending";

  try {
    const merged: string = logs.map(({ raw }) => {
      return raw;
    }).join("\n");

    await writeText(merged);

    status.value = "success";

    setTimeout(() => {
      status.value = "none";
    }, 1000);
  } catch (error: unknown) {
    log.error(__PRE_BUNDLED_FILENAME__, "An error while copying the logs;", Errors.prettify(error));
    status.value = "none";
  }
}
</script>

<template>
  <CustomButton
    :disabled="status !== 'none'"
    :on-click="copy"
    :icon="icon"
    id-root="__log-viewer__header-copy"
    tooltip="Copy the shown logs"
    class="min-h-8"
  />
</template>

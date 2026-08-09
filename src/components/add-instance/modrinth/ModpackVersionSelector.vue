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
import { useQuery } from "@tanstack/vue-query";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { onClickOutside } from "@vueuse/core";
import { markRaw, ref, useTemplateRef } from "vue";

import { InstanceCreationSections } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

const { idRoot, projectId, projectName, close } = defineProps<{
  "idRoot"     : string;
  "projectId"  : string;
  "projectName": string;
  "close"      : () => void;
}>();

const container = useTemplateRef("container");

const pending = ref<boolean>(false);

const { data, status, error } = useQuery({
  "queryKey": [
    "modrinth",
    ModrinthAPI.ProjectType,
    projectId,
    "version",
  ],
  "queryFn": () => markRaw(Modrinth.fetchVersion(projectId)),
});

async function handleClick(event: MouseEvent): Promise<void> {
  if (!data.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "The version was clicked, yet the version data is undefined. How did you do it?",
    );
  }

  let index: number = Number.NaN;

  if (event.target instanceof HTMLElement) {
    index = Number(event.target.dataset.entry);
  }

  if (Number.isNaN(index)) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `The extracted version index of '${projectName}' is not a number`,
    );
  }

  pending.value = true;
  const currentEntry = data.value[index];
  const packURL: string | undefined = currentEntry.files[0].url;

  if (!packURL) {
    pending.value = false;

    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `No '.mrpack' file URL was found in the metadata for '${currentEntry.version_number}'`,
    );
  }

  const response: Response | {
    "status": string;
    "ok"    : false;
    // I don't want to wrap in 'try {} catch {}' again
  } = await fetch(packURL).catch(error => {
    // Lol
    return { "status": Errors.prettify(error), "ok": false as const };
  });

  if (!response.ok) {
    pending.value = false;

    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `Fetch failed with '${response.status}'`,
    );
  }

  const bytes: Uint8Array | false = await response.bytes().catch(error => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to get bytes:",
      Errors.prettify(error),
    );

    return false;
  });

  if (bytes === false) {
    pending.value = false;

    return;
  }

  const cachePath: string = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Cache.Path,
    projectName + currentEntry.version_number + currentEntry.game_versions[0] + ".mrpack",
  );

  const written: void | false = await writeFile(cachePath, bytes)
    .catch(error => {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Failed to write file:",
        Errors.prettify(error),
      );

      return false;
    });

  if (written === false) {
    pending.value = false;

    return;
  }

  const manifest: MrpackManifestType | undefined | void =
    await Modrinth.peekMrpack(cachePath)
      .catch(error => {
        return log.error(
          __PRE_BUNDLED_FILENAME__,
          "Error while peeking the '.mrpack' manifest:",
          Errors.prettify(error),
        );
      });

  pending.value = false;

  if (!manifest) {
    return;
  }
  close();

  Modrinth.applyManifest({ manifest, "path": cachePath });
  globalStates.pages["add-instance"]?.select?.(InstanceCreationSections[0]);
}

onClickOutside(container, close);
</script>

<template>
  <div
    :id="idRoot"
    ref="container"
    class="absolute right-4 top-16 z-100 max-h-120 w-80 overflow-y-auto rounded-md bg-neutral-900 text-white"
  >
    <button
      v-if="data"
      :disabled="pending"
      @click="handleClick"
      :id="`${idRoot}-data`"
      class="w-full flex flex-col break-all text-wrap text-sm disabled:opacity-70"
    >
      <span
        v-for="(entry, index) in data"
        :key="entry.id"
        :id="`${idRoot}-${entry.id}`"
        :data-entry="index"
        class="flex flex-nowrap border-b border-neutral-600 p-2 hover:bg-[theme(colors.neutral.100/.1)]"
      >
        <span
          :id="`${idRoot}-${entry.id}-star`"
          class="pointer-events-none w-6 shrink-0"
        >
          {{ entry.featured ? "⭐" : "" }}
        </span>
        <span
          :id="`${idRoot}-${entry.id}-label`"
          class="pointer-events-none w-full"
        >
          {{ entry.name }}
        </span>
        <span
          :id="`${idRoot}-${entry.id}-loader`"
          class="pointer-events-none shrink-0 text-neutral-300"
        >
          {{ entry.loaders[0] }}
        </span>
      </span>
    </button>
    <div
      v-else-if="status !== 'error'"
      :id="`${idRoot}-pending`"
      class="p-2"
    >
      <div :id="`${idRoot}-pending-icon`" class="i-lucide-loader-circle animate-spin"></div>
    </div>
    <div
      v-else
      :id="`${idRoot}-error`"
      class="p-2"
    >
      An error occurred: {{ error }}
    </div>
  </div>
</template>
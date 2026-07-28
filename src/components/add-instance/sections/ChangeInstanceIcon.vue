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
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { computed } from "vue";

import Image from "@/components/general/base/Image.vue";
import FileStructure from "@/constants/file-structure.ts";
import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);

async function handleIconPick(): Promise<void> {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not select an instance icon since the instance is undefined",
    );
  }

  const selectedIconPath: string | null = await open({
    "multiple" : false,
    "directory": false,
    "title"    : "Select an instance icon (it will be copied)",
    "filters"  : [{
      "name"      : "Image",
      "extensions": ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "apng"],
    }],
  });

  if (!selectedIconPath) {
    return;
  }

  const delimiter = GlobalInternals.joinDelimiter;
  const splitPath: Array<string> = selectedIconPath.split(delimiter);
  const fileName: string = splitPath[splitPath.length - 1];
  const copyDestination: string = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Resources.Path,
    fileName,
  );

  /*
   * If the file was selected from the path to where Kaede usually does not have
   * an access, then the dynamically expanded scope will disappear
   * on the next application launch.
   * That is why we need to copy that file to the 'resources/' folder
   */
  await copyFile(selectedIconPath, copyDestination);

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "icon": convertFileSrc(copyDestination),
    },
  });
}
</script>

<template>
  <div
    id="__add-instance-page__instance-icon-wrapper"
    class="shrink-0 rounded-md p-2"
    title="Instance icon"
  >
    <Image
      id="__add-instance-page__instance-icon-image"
      :src="currentInstance?.icon ?? DefaultInstanceSettings.icon"
      alt="An instance icon"
      class-names="cursor-pointer object-cover rounded-md size-22 hover:opacity-70"
      @click="handleIconPick"
    />
  </div>
</template>

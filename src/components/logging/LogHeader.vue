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
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import CustomInput from "@/components/general/base/CustomInput.vue";
import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { globalStates } from "@/states/global.ts";
import type { LogSearchComposableType } from "@/types/logging/log-searching.type.ts";

const { searcher, status } = defineProps<{
  "searcher": {
    "back"  : () => void;
    "next"  : () => void;
    "reset" : () => void;
    "search": (input: string) => void;
  };
  "status": LogSearchComposableType["status"];
}>();

const filterer = {
  "filter": (input: string): void => {
    globalStates.logs.filtering = input;
  },
  "reset": (): void => {
    globalStates.logs.filtering = "";
  },
};

function viewInExplorer(): Promise<void> {
  const logPath = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  return revealItemInDir(logPath);
}

function onNavigation(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();

    if (event.shiftKey) {
      searcher.back();
    } else {
      searcher.next();
    }
  }

  if (event.key === "Escape") {
    searcher.reset();
  }
}
</script>

<template>
  <div id="__log-viewer__header-wrapper" class="flex flex-wrap gap-2">
    <button
      id="__log-viewer__header-view-in-explorer"
      @click="viewInExplorer"
    >
      View in Explorer
    </button>
    <CustomInput
      focus-on-key-f
      blur-on-escape
      icon="i-lucide-search"
      placeholder="Search logs..."
      id-root="__log-viewer__header-search"
      :debounce-time="300"
      :default-value="status.searching"
      :on-input="searcher.search"
      :on-escape="searcher.reset"
      :on-key-down="onNavigation"
    />
    <CustomInput
      blur-on-escape
      icon="i-lucide-list-filter"
      placeholder="Filter logs..."
      id-root="__log-viewer__header-filter"
      :debounce-time="200"
      :default-value="globalStates.logs.filtering"
      :on-input="filterer.filter"
      :on-escape="filterer.reset"
    />
  </div>
</template>

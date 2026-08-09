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
import { ref } from "vue";

import ModpackBody from "@/components/add-instance/modrinth/ModpackBody.vue";
import ModpackVersionSelector from "@/components/add-instance/modrinth/ModpackVersionSelector.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import type { ModrinthSearchHitType } from "@/types/modrinth/search.type.ts";

const { idRoot, entry } = defineProps<{
  "idRoot": string;
  "entry" : ModrinthSearchHitType;
}>();

const { styles } = useConfigColors();

const downloader = ref<boolean>(false);
const expanded = ref<boolean>(false);

function handleClick(): void {
  expanded.value = !expanded.value;
}

function formatDownloads(downloads: number): string {
  if (downloads >= 1_000_000) {
    return (downloads / 1_000_000).toFixed(1) + "M";
  }

  if (downloads >= 1000) {
    return (downloads / 1000).toFixed(1) + "K";
  }

  return downloads.toString();
}

function handleImport(): void {
  downloader.value = !downloader.value;
}
</script>

<template>
  <div :id="`${idRoot}-wrapper`" class="relative w-full flex flex-col gap-2">
    <div :id="`${idRoot}-button-wrapper`" class="relative">
      <button
        :id="`${idRoot}-button`"
        :class="[
          `${idRoot}`,
          'relative w-full flex flex-nowrap items-center gap-4 rounded-md p-2 text-start',
          'transition-[background-color] hover:bg-[theme(colors.neutral.100/.05)]',
        ]"
        :title="entry.title"
        @click="handleClick"
      >
        <Image
          v-if="entry.icon_url"
          :id="`${idRoot}-icon`"
          :src="entry.icon_url"
          :alt="`An icon of the '${entry.title}' modpack`"
          class-names="size-12 shrink-0 rounded-md object-cover"
        />
        <span
          v-else
          :id="`${idRoot}-placeholder-wrapper`"
          class="grid size-12 shrink-0 place-items-center rounded-md bg-[theme(colors.neutral.100/.1)]"
        >
          <span
            :id="`${idRoot}-placeholder-icon`"
            class="i-lucide-package block size-6"
          ></span>
        </span>
        <span
          :id="`${idRoot}-information`"
          class="min-w-0 flex flex-1 flex-col gap-1"
        >
          <span
            :id="`${idRoot}-information-main`"
            class="flex flex-nowrap items-baseline gap-2"
          >
            <span
              :id="`${idRoot}-information-main-label`"
              class="line-clamp-1 text-ellipsis"
            >
              {{ entry.title }}
            </span>
            <span
              :id="`${idRoot}-information-main-author`"
              class="shrink-0 text-xs"
              :style="styles.widgetSecondary"
            >
              by {{ entry.author }}
            </span>
          </span>
          <span
            :id="`${idRoot}-information-description`"
            class="line-clamp-1 text-ellipsis text-sm"
            :style="styles.widgetSecondary"
          >
            {{ entry.description }}
          </span>
        </span>
        <span
          :id="`${idRoot}-information-stats`"
          class="flex shrink-0 flex-col items-end justify-center gap-1 text-xs"
          :style="styles.widgetSecondary"
        >
          <span
            :id="`${idRoot}-information-stats-downloads`"
            class="flex flex-nowrap items-center gap-1"
            :title="`${entry.downloads} downloads`"
          >
            <span
              :id="`${idRoot}-information-stats-downloads-icon`"
              class="i-lucide-download block size-3"
            />
            {{ formatDownloads(entry.downloads) }}
          </span>
          <span
            :id="`${idRoot}-information-stats-likes`"
            class="flex flex-nowrap items-center gap-1"
            :title="`${entry.follows} followers`"
          >
            <span
              :id="`${idRoot}-information-stats-likes-icon`"
              class="i-lucide-heart block size-3"
            />
            {{ formatDownloads(entry.follows) }}
          </span>
        </span>
        <span :id="`${idRoot}-placeholder`" class="h-1 w-12 shrink-0 bg-transparent" />
        <MaterialRipple />
      </button>
      <button
        :id="`${idRoot}-import-button`"
        @click="handleImport"
        class="absolute right-2 top-4 z-20 mr-2 block h-fit rounded-md p-2 bg-[theme(colors.neutral.100/.05)] hover:bg-[theme(colors.neutral.100/.1)]"
      >
        <span
          :id="`${idRoot}-import-button-icon`"
          class="i-lucide-download block size-5"
        ></span>
        <MaterialRipple />
      </button>
    </div>
    <Transition name="slide-up">
      <ModpackVersionSelector
        v-if="downloader"
        :id-root="`${idRoot}-version-selector`"
        :project-id="entry.project_id"
        :project-name="entry.title"
        :close="() => downloader = false"
      />
    </Transition>
    <ModpackBody
      v-if="expanded"
      :id-root="`${idRoot}-body`"
      :project-id="entry.project_id"
    />
  </div>
</template>

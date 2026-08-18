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
import { computed, markRaw, onMounted, onUnmounted, ref, useTemplateRef } from "vue";

import Checkbox from "@/components/general/base/Checkbox.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import Launcher from "@/lib/launcher";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

const { selected, onToggle } = defineProps<{
  "selected": Array<string>;
  "onToggle": (version: string) => void;
}>();

const rowSize: number = 32;
const rowsAmount: number = 8;

const container = useTemplateRef("container");

const position = ref<number>(0);
const filter = ref<"release" | "all">("release");

const { data, status } = useQuery({
  // The same query key as in 'ChangeInstanceVersionDropdown.vue'
  "queryKey": [
    "meta",
    APIEndpoints.Meta.Paths.Minecraft.Id,
    "versions",
    "do-not-reload",
    Patches.Minecraft,
  ],
  "queryFn": async (): Promise<PatchIndexType["versions"]> => (
    // For some reason, 'useQuery' makes 'data' deeply reactive...
    markRaw(await Launcher.Fetching.fetchAllVersions(Patches.Minecraft))
  ),
});

const versions = computed((): Array<string> => {
  if (status.value !== "success" || !data.value) {
    return [];
  }

  return data
    .value
    .filter(({ type }) => filter.value === "all" || type === filter.value)
    .map(({ version }) => version);
});
const elements = computed((): Array<number> => {
  return Array.from({ "length": rowsAmount }, (_, index) => index);
});

function toggleFilter(): void {
  filter.value = filter.value === "release" ? "all" : "release";
}

// Update the versions array index (called on scroll)
function updateView(event: Event): void {
  const target = event.target as HTMLDivElement | null;

  if (!target) {
    return;
  }

  position.value = Math.round(target.scrollTop / rowSize);
}

onMounted(() => container?.value?.addEventListener?.("scroll", updateView, { "passive": true }));
onUnmounted(() => container?.value?.removeEventListener?.("scroll", updateView));
</script>

<template>
  <div
    id="__add-instance-page__modrinth-versions"
    class="flex flex-col gap-2 rounded-md"
  >
    <div
      id="__add-instance-page__modrinth-versions-header"
      class="flex flex-nowrap items-center justify-between gap-2"
    >
      <p
        id="__add-instance-page__modrinth-versions-label"
        class="pl-1 leading-none"
      >
        Minecraft version
      </p>
      <button
        id="__add-instance-page__modrinth-versions-filter"
        class="relative min-w-16 rounded-md px-2 py-1 text-sm leading-none bg-[theme(colors.neutral.100/.1)]"
        :title="`Showing ${filter} versions`"
        @click="toggleFilter"
      >
        {{ filter }}
        <MaterialRipple />
      </button>
    </div>
    <div
      id="__add-instance-page__modrinth-versions-bound"
      class="relative w-full overflow-y-auto"
      ref="container"
      :style="{ 'height': elements.length * rowSize + 'px' }"
    >
      <div
        id="__add-instance-page__modrinth-versions-placeholder"
        :style="{ 'height': versions.length * rowSize + 'px' }"
      >
        <!--
          -- We are once again falling back to our own virtualizing technique
          -- to avoid enormous RAM usage (up to 30 MBs) created by rendering
          -- lots of buttons with event listeners for all versions. The other
          -- way to avoid that RAM increase is to use one button with spans inside,
          -- just like the Minecraft version dropdown is working in the CleanInstance.vue,
          -- but I like the virtualization method more
          -->
        <label
          v-for="index in elements"
          :id="`__add-instance-page__modrinth-versions-row-${index}`"
          :key="index"
          class="__add-instance-page__modrinth-versions-item sticky h-8 flex flex-nowrap cursor-pointer items-center gap-2 rounded-md p-1 text-sm hover:bg-[theme(colors.neutral.100/.05)]"
          :style="{ 'top': index * rowSize + 'px' }"
        >
          <Checkbox
            transitionless
            :id="`__add-instance-page__modrinth-versions-checkbox-${index}`"
            :value="selected.includes(versions[position + index])"
            :on-toggle="() => onToggle(versions[position + index])"
          />
          <span
            :id="`__add-instance-page__modrinth-versions-item-label-${index}`"
            class="break-all"
          >
          {{ versions[position + index] ?? (status === "pending" ? "Loading..." : "Error...") }}
        </span>
        </label>
      </div>
    </div>
  </div>
</template>

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
import Checkbox from "@/components/general/base/Checkbox.vue";
import Image from "@/components/general/base/Image.vue";
import { ModrinthLoaders } from "@/constants/modrinth.ts";

const { selected, onToggle } = defineProps<{
  "selected": Array<string>;
  "onToggle": (loader: string) => void;
}>();
</script>

<template>
  <div
    id="__add-instance-page__modrinth-loader-scroller-wrapper"
    class="flex flex-col gap-2"
  >
    <p
      id="__add-instance-page__modrinth-loader-scroller-label"
      class="pl-1 leading-none"
    >
      Modloader
    </p>
    <div
      id="__add-instance-page__modrinth-loader-scroller-scroll"
      class="flex flex-col overflow-y-auto"
    >
      <label
        v-for="loader in ModrinthLoaders"
        :id="`__add-instance-page__modrinth-loader-scroller-item-${loader.id}`"
        :key="loader.id"
        class="__add-instance-page__modrinth-loaders-item flex flex-nowrap cursor-pointer items-center gap-2 rounded-md p-1 text-sm hover:bg-[theme(colors.neutral.100/.05)]"
      >
        <Checkbox
          :id="`__add-instance-page__modrinth-loader-scroller-item-checkbox-${loader.id}`"
          :value="selected.includes(loader.id)"
          :on-toggle="() => onToggle(loader.id)"
        />
        <Image
          :id="`__add-instance-page__modrinth-loader-scroller-item-icon-${loader.id}`"
          :src="loader.icon"
          :alt="`An icon of the '${loader.name}' modloader`"
          class-names="size-5 rounded-md"
        />
        <span :id="`__add-instance-page__modrinth-loader-scroller-item-label-${loader.id}`">
          {{ loader.name }}
        </span>
      </label>
    </div>
  </div>
</template>

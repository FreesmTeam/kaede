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

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";

const {
  idRoot,
  page,
  total,
  siblings = 2,
  onSelect,
} = defineProps<{
  "idRoot"    : string;
  "page"      : number;
  "total"     : number;
  "siblings" ?: number;
  "onSelect" ?: (page: number) => void;
}>();

const { styles } = useConfigColors();

const pages = computed((): Array<number | "gap"> => {
  if (total <= 1) {
    return [];
  }

  const items: Array<number | "gap"> = [];

  const first = 1;
  const start = Math.max(first + 1, page - siblings);
  const end = Math.min(total - 1, page + siblings);

  items.push(first);

  if (start > first + 1) {
    items.push("gap");
  }

  for (let current = start; current <= end; current++) {
    items.push(current);
  }

  if (end < total - 1) {
    items.push("gap");
  }

  if (total > first) {
    items.push(total);
  }

  return items;
});

function handleSelect(selected: number): void {
  if (selected === page || selected < 1 || selected > total) {
    return;
  }

  onSelect?.(selected);
}
</script>

<template>
  <div
    v-if="pages.length > 0"
    :id="`${idRoot}-wrapper`"
    class="w-full flex flex-nowrap items-center justify-between gap-1 rounded-md"
  >
    <button
      :id="`${idRoot}-previous`"
      :disabled="page <= 1"
      @click="() => handleSelect(page - 1)"
      title="Previous page"
      class="relative grid size-8 shrink-0 place-items-center rounded-md transition-[opacity] bg-[theme(colors.neutral.100/.1)] disabled:opacity-40"
    >
      <span
        :id="`${idRoot}-previous-icon`"
        class="i-lucide-chevron-left block size-4"
      ></span>
      <MaterialRipple :disabled="page <= 1" />
    </button>
    <div :id="`${idRoot}-inner`" class="flex flex-nowrap">
      <template v-for="(item, index) in pages">
      <span
        v-if="item === 'gap'"
        :id="`${idRoot}-gap-${index}`"
        :key="`gap-${index}`"
        class="grid size-8 shrink-0 place-items-center leading-none"
        :style="styles.widgetSecondary"
      >
        …
      </span>
        <button
          v-else
          :id="`${idRoot}-page-${item}`"
          :key="item"
          :disabled="item === page"
          @click="() => handleSelect(item)"
          :title="`Page ${item}`"
          :class="[
          `${idRoot}-page`,
          'relative size-8 shrink-0 grid place-items-center rounded-md text-sm',
          'transition-[background-color] disabled:bg-[theme(colors.neutral.100/.1)]',
          'hover:bg-[theme(colors.neutral.100/.05)]',
        ]"
        >
          {{ item }}
          <MaterialRipple :disabled="item === page" />
        </button>
      </template>
    </div>
    <button
      :id="`${idRoot}-next`"
      :disabled="page >= total"
      @click="() => handleSelect(page + 1)"
      title="Next page"
      class="relative grid size-8 shrink-0 place-items-center rounded-md transition-[opacity] bg-[theme(colors.neutral.100/.1)] disabled:opacity-40"
    >
      <span
        :id="`${idRoot}-next-icon`"
        class="i-lucide-chevron-right block size-4"
      ></span>
      <MaterialRipple :disabled="page >= total" />
    </button>
  </div>
</template>

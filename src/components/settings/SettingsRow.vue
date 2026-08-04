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
import Row from "@/components/general/base/Row.vue";
import Toggle from "@/components/general/base/Toggle.vue";
import type { SettingsRowType } from "@/types/ui/settings-row.type.ts";

const { row } = defineProps<{
  "row": SettingsRowType;
}>();

const classNames = computed((): string | undefined => {
  if (row.disabled) {
    return "opacity-50";
  }

  if (row.onClick) {
    return "relative cursor-pointer";
  }

  return undefined;
});
const handler = computed((): {
  "callback": (event: MouseEvent) => void;
} => {
  if (row.disabled || row.onClick === undefined) {
    return { "callback": (): void => {} };
  }

  return { "callback": row.onClick };
});
</script>

<template>
  <Row
    :id-root="row.idRoot"
    :class="classNames"
    :icon="row.icon"
    :image="row.image"
    :title="row.title"
    :subtitle="row.subtitle"
    @click="handler.callback"
  >
    <!-- leaf controls -->
    <Toggle
      v-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'toggle'"
      :id="`${row.idRoot}-toggle`"
      class="pointer-events-none"
      :value="row.inner.value"
    />
    <MaterialRipple v-if="!row.disabled && row.onClick" />
  </Row>

  <!-- nested child rows -->
  <template v-if="Array.isArray(row.inner)">
    <SettingsRow v-if="row.empty && row.inner.length === 0" :row="row.empty" />
    <div
      v-for="childRow in row.inner"
      :key="childRow.idRoot"
      :id="`${childRow.idRoot}-padding`"
      class="flex flex-nowrap items-center gap-6 pl-6"
    >
      <div :id="`${childRow.idRoot}-divider`" class="h-8 w-[1px] bg-neutral-400"></div>
      <SettingsRow
        :row="childRow"
      />
    </div>
  </template>
</template>

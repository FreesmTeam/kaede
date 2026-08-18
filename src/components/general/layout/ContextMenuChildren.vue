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
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import type { ActionKeyType } from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const { idRoot, children } = defineProps<{
  "idRoot"  : string;
  "children": GlobalStatesType["contextMenuItems"];
}>();

function wrapAction(item: GlobalStatesType["contextMenuItems"][number], event: MouseEvent): void {
  if (item !== "divider" && "action" in item) {
    const action: ActionKeyType = item.action;

    void ActionRegistry.execute(action, event);
  }
}

function normalizeKey(item: GlobalStatesType["contextMenuItems"][number], index: number): string {
  return item === "divider"
    ? `${item}-${index}`
    : `${item.name}-${index}`;
}
</script>

<template>
  <div
    v-for="(item, index) in children"
    :key="normalizeKey(item, index)"
    :id="`${idRoot}-${normalizeKey(item, index)}`"
    class="__context_menu__entry-wrapper relative w-full"
  >
    <div
      v-if="item === 'divider'"
      :id="`${idRoot}-${item}-${index}`"
      class="mx-auto h-[1px] w-[calc(100%-16px)] shrink-0 bg-[theme(colors.neutral.100/.1)]"
    ></div>
    <template v-else>
      <button
        :id="`${idRoot}-${item.name}`"
        @click="event => wrapAction(item, event)"
        class="__context_menu__entry __context-menu-disable relative w-full flex flex-nowrap items-center gap-2 p-2 hover:bg-neutral-700"
      >
        <span
          v-if="item.icon"
          :id="`${idRoot}-${item.name}-icon`"
          :class="[item.icon, '__context-menu-disable block size-4']"
        ></span>
        <Image
          v-else-if="item.image"
          :id="`${idRoot}-${item.name}-image`"
          :src="item.image"
          :alt="`An image for the ${item.name} context menu item`"
          class-names="__context-menu-disable size-4"
        />
        <span
          :id="`${idRoot}-${item.name}-label`"
          class="__context-menu-disable block whitespace-nowrap text-sm leading-none"
        >
          {{ item.name }}
        </span>
        <span
          v-if="'children' in item"
          :id="`${idRoot}-${item.name}-chevron-right`"
          class="__context-menu-disable __context-menu-chevron-right i-lucide-chevron-right ml-auto block size-4 transition-[transform]"
        ></span>
        <MaterialRipple :disabled="'children' in item" />
      </button>
      <div
        v-if="'children' in item"
        :id="`${idRoot}-${item.name}-popup-wrapper`"
        class="__context_menu__popup-wrapper invisible absolute left-full top-0 flex flex-col gap-1 rounded-r-md bg-neutral-800 py-1 text-white"
      >
        <ContextMenuChildren
          :id-root="`${idRoot}-${item.name}-popup`"
          :children="item.children"
        />
      </div>
    </template>
  </div>
</template>

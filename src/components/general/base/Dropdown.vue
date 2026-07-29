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
import { onClickOutside } from "@vueuse/core";
import { useTemplateRef } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import type { DropdownItemType } from "@/types/ui/dropdown-item.type.ts";

const { shown, close, id, sizeClassNames, addClassNames, items } = defineProps<{
  "shown"         : boolean;
  "close"         : (event?: Event) => void;
  "id"            : string;
  "addClassNames" : string;
  "sizeClassNames": string;
  "items"         : Array<DropdownItemType>;
}>();

const target = useTemplateRef("target");

onClickOutside(target, close);
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="shown"
      ref="target"
      :id="id"
      :class="[
        'overflow-y-auto rounded-md bg-neutral-900 py-1',
        addClassNames,
        sizeClassNames,
      ]"
    >
      <template v-if="items.length > 0">
        <Transition appear name="slide-up-extra">
          <div
            :id="`${id}-items-wrapper`"
            class="h-full flex flex-col gap-1"
          >
            <button
              v-for="item in items"
              :key="item.id"
              :id="item.id"
              :disabled="item.disabled"
              @click="item.onclick"
              class="relative flex flex-nowrap items-center gap-2 p-2 transition-[background-color] disabled:bg-transparent disabled:opacity-50 hover:bg-[theme(colors.neutral.100/.05)]"
            >
              <Image
                v-if="item.image"
                :id="`${item.id}-image`"
                class-names="block object-cover rounded-md size-12 p-1"
                :src="item.image"
                :alt="`${item.title}'s image logo`"
              />
              <span
                v-else-if="item.icon"
                :id="`${item.id}-icon-wrapper`"
                class="grid size-12 shrink-0 place-items-center"
              >
                <span
                  :id="`${item.id}-icon-inner`"
                  :class="['block size-8', item.icon]"
                ></span>
              </span>
              <span
                :id="`${item.id}-information-wrapper`"
                class="flex flex-col items-start pr-1"
              >
                <span
                  :id="`${item.id}-information-title`"
                  class="block text-start font-medium"
                >
                  {{ item.title }}
                </span>
                <span
                  :id="`${item.id}-information-subtitle`"
                  class="block text-start text-neutral-400"
                >
                  {{ item.subtitle }}
                </span>
              </span>
              <MaterialRipple :disabled="item.disabled" />
            </button>
          </div>
        </Transition>
      </template>
      <template v-else>
        <div
          v-if="items.length === 0"
          :id="`${id}-no-items`"
          class="mx-8 my-8 border-t border-neutral-600 py-4 text-center text-neutral-300"
        >
          Nothing here yet
        </div>
      </template>
    </div>
  </Transition>
</template>

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
import { modalStates, type PendingModalType } from "@/states/modal.ts";

const queue = computed((): Array<PendingModalType> => {
  return [...modalStates];
});
const current = computed((): PendingModalType | undefined => {
  return queue.value[0];
});
</script>

<template>
  <Transition name="pop">
    <div
      v-if="current"
      id="__modal__item-wrapper"
      class="absolute bottom-0 left-0 right-0 top-0 z-7500 grid place-items-center px-8 bg-[theme(colors.black/.5)]"
    >
      <div
        id="__modal__item-inner"
        class="max-h-vh max-w-120 w-full flex flex-col items-center gap-4 overflow-y-auto rounded-xl bg-neutral-900 p-6"
      >
        <div
          id="__modal__item-icon-wrapper"
          class="w-full flex justify-center"
        >
          <div
            id="__modal__item-icon"
            :class="[
              current.icon || 'i-lucide-info',
              'size-6 text-neutral-300',
            ]"
          ></div>
        </div>
        <div
          id="__modal__item-title"
          class="w-full text-center text-balance text-2xl text-white"
        >
          {{ current.title }}
        </div>
        <div
          id="__modal__item-description"
          class="w-full text-start text-pretty text-sm text-neutral-300"
        >
          {{ current.description }}
        </div>
        <div
          v-if="current.rows"
          id="__modal__item-rows"
          class="w-full flex flex-col gap-2"
        >
          <div
            v-for="row in current.rows"
            :key="row.title"
            :id="`__modal__item-rows-${row.title}-row`"
            class="w-full flex flex-nowrap gap-2 text-neutral-300"
          >
            <div
              :id="`__modal__item-rows-${row.title}-row-icon-wrapper`"
              class="size-8 flex shrink-0 items-center justify-center"
            >
              <div
                v-if="row.icon"
                :id="`__modal__item-rows-${row.title}-row-icon`"
                :class="[row.icon, 'size-6']"
              ></div>
            </div>
            <div
              :id="`__modal__item-rows-${row.title}-row-information`"
              class="w-full flex flex-col gap-1"
            >
              <p :id="`__modal__item-rows-${row.title}-row-title`" class="text-start text-neutral-100 leading-none">
                {{ row.title }}
              </p>
              <p :id="`__modal__item-rows-${row.title}-row-description`" class="whitespace-pre-wrap text-start text-pretty text-sm text-neutral-400">
                {{ row.description }}
              </p>
            </div>
          </div>
        </div>
        <div
          id="__modal__item-actions"
          class="w-full flex flex-nowrap justify-end gap-2"
        >
          <button
            v-for="action in current.actions"
            :key="action.label"
            :id="`__modal__item-action-${action.label}`"
            class="relative rounded-lg p-3 text-sm leading-none transition-[background-color] hover:bg-[theme(colors.neutral.100/.05)]"
          >
            {{ action.label }}
            <MaterialRipple />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

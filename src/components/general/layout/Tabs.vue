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
import { computed, ref } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { TabSectionType } from "@/types/ui/tab-section.type.ts";

const { sections, stateKey } = defineProps<{
  "sections": Array<TabSectionType>;
  "stateKey": Extract<
    keyof GlobalStatesType["pages"],
    "add-instance" | "settings"
  >;
}>();

const disabled = ref<string>();
const selected = computed((): string => (
  globalStates?.pages?.[stateKey]?.tab ?? sections[0].id
));
const { styles } = useConfigColors();

async function handleModeSelect(tab: TabSectionType): Promise<void> {
  disabled.value = tab.id;

  if (tab.await) {
    await tab.await();

    // Prevent a race condition
    if (disabled.value !== tab.id) {
      return;
    }
  }

  globalStates.pages[stateKey].tab = tab.id;
}
</script>

<template>
  <div
    :id="`__${stateKey}-page__type-selector`"
    class="h-fit w-full flex shrink-0 flex-wrap gap-2 rounded-md p-2"
    :style="styles.widget"
  >
    <button
      v-for="tab in sections"
      :key="tab.id"
      :disabled="selected === tab.id || disabled === tab.id"
      @click="() => tab?.action?.(tab.id) ?? handleModeSelect(tab)"
      :id="`__${stateKey}-page__type-selector-item-${tab.id}`"
      :class="[
        `__${stateKey}-page__type-selector-item`,
        'relative min-w-fit flex flex-1 flex-nowrap items-center justify-center gap-2',
        'rounded-md py-1 pl-1 pr-2 transition-[background-color] duration-150',
        'disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]',
      ]"
    >
      <span
        v-if="tab.icon"
        :id="`__${stateKey}-page__type-selector-icon-${tab.id}`"
        :class="[tab.icon, 'block size-5']"
      ></span>
      <Image
        v-else-if="tab.image"
        :id="`__${stateKey}-page__type-selector-image-${tab.id}`"
        :src="tab.image"
        :alt="`An icon of the '${tab.name}' tab selector`"
        class-names="size-6"
      />
      <span
        :id="`__${stateKey}-page__type-selector-item-label-${tab.id}`"
        class="shrink-0"
      >
        {{ tab.name }}
      </span>
      <MaterialRipple :disabled="selected === tab.id || disabled === tab.id" />
    </button>
  </div>
</template>

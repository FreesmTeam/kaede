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
import { computed, inject } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import {
  TranslationsContextKey,
} from "@/constants/application.ts";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const { styles } = useConfigColors();

const Translations = inject<TranslationsStateType>(TranslationsContextKey);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.selected?.currentInstance)
));
const lastLaunch = computed(() => {
  const currentMillisecondsTime: number | undefined =
    currentInstance?.value?.instance?.lastLaunch;

  // Treat falsy values equally (e.g. zero, null, or undefined)
  if (!currentMillisecondsTime) {
    return "Never";
  }

  const date: Date = new Date(currentMillisecondsTime);

  return date.toDateString();
});

function handleSwitch(): void {
  globalStates.selected.stats = "playtime";
}
</script>

<template>
  <button
    id="__home-page__last-launch-button"
    @click="handleSwitch"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color] hover:bg-[theme(colors.neutral.100/.05)]"
  >
    <span
      id="__home-page__last-launch-icon-wrapper"
      class="grid size-12 shrink-0 place-items-center"
    >
      <span
        id="__home-page__last-launch-icon"
        class="i-lucide-clock-fading block size-8"
        :style="styles.text"
      ></span>
    </span>
    <span
      id="__home-page__current-playtime-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-playtime-information-label"
        class="block font-medium"
        :style="styles.text"
      >
        {{ Translations?.Messages?.["home.instance.last-launch.label"] }}
      </span>
      <span
        id="__home-page__current-instance-information-version"
        class="block text-sm"
        :style="styles.textSecondary"
      >
        {{ lastLaunch }}
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>

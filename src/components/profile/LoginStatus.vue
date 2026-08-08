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
import { inject } from "vue";

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { TranslationsContextKey } from "@/constants/application.ts";
import { globalStates } from "@/states/global.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const { styles } = useConfigColors();

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
</script>

<template>
  <span
    v-if="globalStates.pages.profile.pending && globalStates.pages.profile.step"
    id="__profile-page__sign-in-status"
    class="text-sm"
    :style="styles.widgetSecondary"
  >
    ({{ Translations?.Messages?.[`profile.sign-in.status.${globalStates.pages.profile.step}`] }})
  </span>
  <span
    v-if="globalStates.pages.profile.error !== null"
    id="__profile-page__sign-in-error"
    class="text-sm text-red-400"
  >
    ({{ globalStates.pages.profile.error }})
  </span>
</template>
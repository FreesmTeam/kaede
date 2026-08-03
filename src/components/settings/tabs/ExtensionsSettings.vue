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
import RowContainer from "@/components/general/base/RowContainer.vue";
import SettingsRow from "@/components/settings/SettingsRow.vue";
import { ExtensionsSettingsRows } from "@/constants/row-collections.ts";
</script>

<template>
  <div
    id="__settings-page__extensions-wrapper"
    class="h-fit w-full flex flex-col gap-2 pb-2"
  >
    <RowContainer id="__settings-page__extensions-inner">
      <SettingsRow
        v-for="row in ExtensionsSettingsRows"
        :row="row.value"
        :key="row.value.idRoot"
      />
    </RowContainer>
  </div>
</template>

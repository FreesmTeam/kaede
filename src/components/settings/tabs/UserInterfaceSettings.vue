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
import { invoke } from "@tauri-apps/api/core";
import { onMounted } from "vue";

import RowContainer from "@/components/general/base/RowContainer.vue";
import SettingsRow from "@/components/settings/SettingsRow.vue";
import FileStructure from "@/constants/file-structure.ts";
import { ReadLocales, UserInterfaceSettingsRows } from "@/constants/row-collections.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";

onMounted(() => {
  const directory: string = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Translations.Path,
  );

  invoke<Array<{ "name": string; "code": string }>>("get_locales", { directory })
    .then(list => {
      const set = new Set<string>(
        ReadLocales.map(({ id }) => id),
      );

      for (const { name, code } of list) {
        if (set.has(code)) {
          continue;
        }

        ReadLocales.push({ "label": name, "id": code });
      }
    })
    .catch(error => {
      log.error(__PRE_BUNDLED_FILENAME__, Errors.prettify(error));
    });
});
</script>

<template>
  <div
    id="__settings-page__user-interface-wrapper"
    class="h-fit w-full flex flex-col gap-2 pb-2"
  >
    <RowContainer id="__settings-page__user-interface-inner">
      <SettingsRow
        v-for="row in UserInterfaceSettingsRows"
        :row="row.value"
        :key="row.value.idRoot"
      />
    </RowContainer>
  </div>
</template>

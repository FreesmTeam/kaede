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
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, markRaw, ref } from "vue";

import LoaderScroller from "@/components/add-instance/modrinth/LoaderScroller.vue";
import ModpackEntry from "@/components/add-instance/modrinth/ModpackEntry.vue";
import VersionScroller from "@/components/add-instance/modrinth/VersionScroller.vue";
import ImportModpack from "@/components/add-instance/sections/ImportModpack.vue";
import CustomInput from "@/components/general/base/CustomInput.vue";
import Pagination from "@/components/general/base/Pagination.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import Errors from "@/lib/errors";
import Modrinth from "@/lib/modrinth";
import type { ModrinthSearchResponseType } from "@/types/modrinth/search.type.ts";

const { styles } = useConfigColors();

const search = ref<string>("");
const gameVersions = ref<Array<string>>([]);
const loaders = ref<Array<string>>([]);
const page = ref<number>(1);

const queryKey = computed((): Array<unknown> => [
  "modrinth",
  ModrinthAPI.ProjectType,
  search.value,
  gameVersions.value,
  loaders.value,
  page.value,
]);

const { data, status, error, isFetching } = useQuery({
  "queryKey": queryKey,
  "queryFn" : async (): Promise<ModrinthSearchResponseType> => (
    // For some reason, 'useQuery' makes 'data' deeply reactive...
    markRaw(await Modrinth.search({
      "query"       : search.value,
      "gameVersions": gameVersions.value,
      "loaders"     : loaders.value,
      "offset"      : (page.value - 1) * ModrinthAPI.PageSize,
      "limit"       : ModrinthAPI.PageSize,
    }))
  ),
  "staleTime"      : Infinity,
  "placeholderData": keepPreviousData,
});

const totalPages = computed((): number => {
  if (!data.value) {
    return 0;
  }

  return Math.ceil(data.value.total_hits / ModrinthAPI.PageSize);
});

function toggleInside(list: Array<string>, value: string): Array<string> {
  page.value = 1;

  if (list.includes(value)) {
    return list.filter(current => current !== value);
  }

  return [...list, value];
}

function handleSearch(input: string): void {
  page.value = 1;
  search.value = input;
}
function handleGameVersion(version: string): void {
  gameVersions.value = toggleInside(gameVersions.value, version);
}
function handleLoader(loader: string): void {
  loaders.value = toggleInside(loaders.value, loader);
}
function handlePage(selected: number): void {
  page.value = selected;
}

</script>

<template>
  <div
    id="__add-instance-page__modrinth-wrapper"
    class="h-fit w-full flex flex-wrap gap-2 md:flex-nowrap"
  >
    <div
      id="__add-instance-page__modrinth-controls"
      class="top-2 h-fit w-full flex flex-col gap-2 rounded-md p-2 md:sticky md:w-64 md:shrink-0"
      :style="styles.widget"
    >
      <CustomInput
        icon="i-lucide-search"
        id-root="__add-instance-page__modrinth-search"
        type="text"
        placeholder="Search modpacks"
        tooltip="Search modpacks on Modrinth"
        :debounce-time="300"
        :default-value="search"
        :on-input="handleSearch"
        :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
      />
      <ImportModpack />
      <VersionScroller
        :selected="gameVersions"
        :on-toggle="handleGameVersion"
      />
      <LoaderScroller
        :selected="loaders"
        :on-toggle="handleLoader"
      />
    </div>
    <div
      id="__add-instance-page__modrinth-contents"
      :class="[
        isFetching ? 'opacity-70' : 'opacity-100',
        'min-w-0 w-full flex flex-col gap-2 rounded-md p-2 transition-[opacity]',
      ]"
      :style="styles.widget"
    >
      <p
        v-if="status === 'pending'"
        id="__add-instance-page__modrinth-contents-loading"
        class="p-2"
        :style="styles.widgetSecondary"
      >
        Loading...
      </p>
      <p
        v-else-if="status === 'error'"
        id="__add-instance-page__modrinth-contents-error"
        class="p-2"
        :style="styles.widgetSecondary"
      >
        Could not reach Modrinth: {{ Errors.prettify(error) }}
      </p>
      <p
        v-else-if="data && data.hits.length === 0"
        id="__add-instance-page__modrinth-contents-empty"
        class="p-2"
        :style="styles.widgetSecondary"
      >
        No modpacks match these filters :c
      </p>
      <template v-else-if="data">
        <Pagination
          id-root="__add-instance-page__modrinth-pagination"
          :page="page"
          :total="totalPages"
          :on-select="handlePage"
        />
        <ModpackEntry
          v-for="entry in data.hits"
          :key="entry.project_id"
          :id-root="`__add-instance-page__modrinth-entry-${entry.project_id}`"
          :entry="entry"
        />
        <Pagination
          id-root="__add-instance-page__modrinth-pagination"
          :page="page"
          :total="totalPages"
          :on-select="handlePage"
        />
      </template>
    </div>
  </div>
</template>

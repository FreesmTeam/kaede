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
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  ExtendedPatchUIDType, PatchDependencyType,
  PatchIndexType, PatchVariantType,
} from "@/types/launcher/meta/patch-index.type.ts";

const { handleDropdown, currentFilter } = defineProps<{
  "handleDropdown": (state: boolean, event?: PointerEvent) => void;
  "currentFilter" : "release" | "all";
}>();

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.states?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

const queryKey = computed((): Array<unknown> => [
  "meta",
  APIEndpoints.Meta.Paths.Minecraft.Id,
  "versions",
  currentPatch.value === Patches.Minecraft
    ? "do-not-reload"
    : currentInstance.value?.patchVersions?.["net.minecraft"],
  currentPatch.value,
]);

const noMatches = {
  "version"    : "No matches",
  "recommended": false,
  "releaseTime": "",
} as const;

const { data, status } = useQuery({
  "queryKey": queryKey,
  "queryFn" : (): Promise<PatchIndexType["versions"]> => {
    return Launcher.Fetching.fetchAllVersions(
      currentPatch.value,
      currentInstance.value?.patchVersions?.["net.minecraft"],
    );
  },
});

const filteredVersions = computed((): Array<{
  "recommended": boolean;
  "releaseTime": string;
  "version"    : string;
  "type"      ?: PatchVariantType;
  "requires"  ?: Array<PatchDependencyType>;
  "conflicts" ?: Array<PatchDependencyType>;
}> => {
  if (status.value !== "success" || !data.value) {
    return [{
      "version": status.value === "success"
        ? "No data?.."
        : "Loading...",
      "recommended": false,
      "releaseTime": "",
    }];
  }

  const filteringValue: string | undefined = currentVersionSearch.value?.input;

  /*
   * Format the release time ahead-of-time and
   * re-create the array to avoid changing the Vue Query cache
   */
  const mappedData: Array<{
    "recommended": boolean;
    "releaseTime": string;
    "version"    : string;
    "type"      ?: PatchVariantType;
    "requires"  ?: Array<PatchDependencyType>;
    "conflicts" ?: Array<PatchDependencyType>;
  }> = data
    .value
    .map(entry => ({
      "recommended": entry.recommended,
      "version"    : entry.version,
      "type"       : entry.type,
      "releaseTime": entry.releaseTime,
      "requires"   : entry.requires,
      "conflicts"  : entry.conflicts,
    }));

  if (!filteringValue) {
    const filteredData = mappedData
      .filter(({ type }) => (

        /*
         * If user needs all versions, then the first condition holds.
         * Otherwise, they only need 'release' ones.
         * Note that the type filter only applies to Minecraft patches
         */
        currentFilter === "all" ||
        type === currentFilter ||
        currentPatch.value !== Patches.Minecraft
      ));

    if (filteredData.length === 0) {
      return [noMatches];
    }

    return filteredData;
  }

  const filteredData = mappedData
    .filter(({ version, type }) => (
      version.includes(filteringValue) &&

      /*
       * If user needs all versions, then the first condition holds.
       * Otherwise, they only need 'release' ones.
       * Note that the type filter only applies to Minecraft patches
       */
      (
        currentFilter === "all" ||
        type === currentFilter ||
        currentPatch.value !== Patches.Minecraft
      )
    ));

  if (filteredData.length === 0) {
    return [noMatches];
  }

  return filteredData;
});

function selectVersion(event: MouseEvent): void {
  const target = event?.target as HTMLSpanElement | undefined;

  if (!target) {
    return;
  }

  // ["__add", "instance", "page__instance", "version", "dropdown", "item", element_type, version]
  const splitId: Array<string> = target?.id?.split?.("-");
  const extractedVersion: string = splitId.slice(7).join("-");

  if (
    !extractedVersion ||
    !currentInstance.value ||
    !currentPatch.value ||
    // Sometimes it may happen...
    extractedVersion === "Loading..." ||
    // This can happen as well if the user click "No Matches"
    extractedVersion === noMatches.version
  ) {
    return;
  }

  // If user changes the minecraft version, we need to reset all patch versions
  const handledPatchVersions = currentPatch.value === Patches.Minecraft ? {
    [currentPatch.value]: extractedVersion,
  } : {
    ...currentInstance.value.patchVersions,
    [currentPatch.value]: extractedVersion,
  };

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "patchVersions": handledPatchVersions,
    },
  });
}
function slideOverVersions(event: MouseEvent): void {
  const pressed: number = event.buttons;

  // '1' means that the user has clicked the primary mouse button
  if (pressed !== 1) {
    return;
  }

  selectVersion(event);
}
</script>

<template>
  <button
    id="__add-instance-page__instance-version-dropdown-wrapper"
    class="absolute left-0 top-14 z-50 max-h-73 w-full flex flex-col overflow-y-auto break-all rounded-md text-start text-sm"
    :style="cardStyles"
    @pointerdown="selectVersion"
    @pointerover="slideOverVersions"
    @pointerup="event => handleDropdown(false, event)"
  >
    <span
      v-for="entry in filteredVersions"
      :id="`__add-instance-page__instance-version-dropdown-item-wrapper-${entry.version}`"
      :key="entry.version"
      class="__add-instance-page__instance-version-dropdown-item flex flex-nowrap border-b border-neutral-600 p-2 text-neutral-300 hover:bg-[theme(colors.neutral.100/.1)]"
    >
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-star-${entry.version}`"
        class="w-6 shrink-0"
      >
        {{ entry.recommended ? "⭐" : "" }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-version-${entry.version}`"
        class="flex-1"
      >
        {{ entry.version }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-type-${entry.version}`"
        class="flex-1"
      >
        {{ entry?.type }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-time-${entry.version}`"
        class="flex-1"
      >
        {{ entry.releaseTime }}
      </span>
    </span>
  </button>
</template>

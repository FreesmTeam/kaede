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

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { InstallablePatches, Patches } from "@/constants/meta.ts";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));

function handlePatch(uid: ExtendedPatchUIDType): void {
  globalStates.pages["add-instance"].instanceVersionSearch = {
    ...currentVersionSearch.value,
    "patch": uid,
    // Reset the search bar as well
    "input": "",
  };
}
</script>

<template>
  <div
    id="__add-instance-page__instance-patch"
    class="flex flex-wrap gap-2 rounded-md p-2"
  >
    <button
      v-for="patch in InstallablePatches"
      :id="`__add-instance-page__item-patch-${patch.id}`"
      :key="patch.uid"
      :disabled="currentPatch === patch.uid"
      @click="() => patch?.action?.(patch.uid) ?? handlePatch(patch.uid)"
      class="__add-instance-page__item relative flex flex-1 flex-col items-center justify-center gap-2 rounded-md p-2 transition-[background-color] disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
    >
       <Image
         v-if="patch.icon"
         :id="`__add-instance-page__item-patch-icon-${patch.id}`"
         :src="patch.icon"
         :alt="`An icon of the '${patch.uid}' patch`"
         class-names="min-w-10 rounded-md size-10"
       />
      <span :id="`__add-instance-page__item-patch-label-${patch.id}`" class="block text-sm">
        {{ patch.name }}
      </span>
      <MaterialRipple :disabled="currentPatch === patch.uid" />
    </button>
  </div>
</template>

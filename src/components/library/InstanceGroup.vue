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
import InstanceEntry from "@/components/library/InstanceEntry.vue";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

const { idRoot, group } = defineProps<{
  "idRoot": string;
  "group" : {
    "id"       : string;
    "instances": Array<[string, InstanceStateType]>;
  };
}>();
</script>

<template>
  <div
    :id="idRoot"
  >
    <div
      :id="`${idRoot}-title`"
    >
      {{ group.id }}
    </div>
    <div
      :id="`${idRoot}-instances`"
      class="flex flex-wrap gap-2"
    >
      <InstanceEntry
        v-for="entry in group.instances"
        :key="entry[0]"
        :id-root="`${idRoot}-instances-entry-${entry[0]}`"
        :instance-id="entry[0]"
        :instance="entry[1]"
      />
    </div>
  </div>
</template>
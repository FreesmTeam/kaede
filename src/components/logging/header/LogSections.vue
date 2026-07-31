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
import { useTemplateRef } from "vue";

import { useLogResizer } from "@/composables/use-log-resizer.ts";
import { globalStates } from "@/states/global.ts";

const characterElement = useTemplateRef<HTMLDivElement>("characterElement");

const { resizeSection, toggleSection } = useLogResizer(characterElement);
</script>

<template>
  <div
    id="__log-viewer__tab-sections"
    class="flex flex-nowrap items-center overflow-x-auto border-x border-t border-neutral-500 font-mono bg-[theme(colors.black/.3)]"
    :style="{
      'color': globalStates.ui.widget.secondaryColor ?? '#D4D4D4',
    }"
  >
    <div ref="characterElement" id="__log-viewer__font-calculation" class="invisible absolute shrink-0 select-none font-mono">
      .
    </div>
    <div
      id="__log-viewer__tab-section-line-number"
      class="w-12 shrink-0 whitespace-pre text-center"
    >
      #
    </div>
    <div id="__log-viewer__tab-section-separator-1" class="mr-2 h-3 w-[1px] bg-neutral-500"></div>
    <button
      @click="() => toggleSection('time')"
      id="__log-viewer__tab-section-time"
      :class="[
        globalStates.logs.partsShown.time ? '' : 'opacity-70',
        'shrink-0 whitespace-pre pr-[3px]',
      ]"
    >
      {{ "time".padEnd(globalStates.logs.partsSize.time) }}
    </button>
    <button
      id="__log-viewer__tab-section-separator-2"
      class="h-3 cursor-col-resize pl-1 pr-2"
      @pointerdown="event => resizeSection(event, 'time')"
    >
      <span id="__log-viewer__tab-section-separator-inner-2" class="block h-3 w-[1px] bg-neutral-500"></span>
    </button>
    <button
      @click="() => toggleSection('level')"
      id="__log-viewer__tab-section-level"
      :class="[
        globalStates.logs.partsShown.level ? '' : 'opacity-70',
        'shrink-0 whitespace-pre pr-[3px]',
      ]"
    >
      {{ "level".padEnd(globalStates.logs.partsSize.level) }}
    </button>
    <button
      id="__log-viewer__tab-section-separator-3"
      class="h-3 cursor-col-resize pl-1 pr-2"
      @pointerdown="event => resizeSection(event, 'level')"
    >
      <span id="__log-viewer__tab-section-separator-inner-3" class="block h-3 w-[1px] bg-neutral-500"></span>
    </button>
    <button
      @click="() => toggleSection('target')"
      id="__log-viewer__tab-section-target"
      :class="[
        globalStates.logs.partsShown.target ? '' : 'opacity-70',
        'shrink-0 whitespace-pre pr-[3px]',
      ]"
    >
      {{ "target".padEnd(globalStates.logs.partsSize.target) }}
    </button>
    <button
      id="__log-viewer__tab-section-separator-4"
      class="h-3 cursor-col-resize pl-1 pr-2"
      @pointerdown="event => resizeSection(event, 'target')"
    >
      <span id="__log-viewer__tab-section-separator-inner-4" class="block h-3 w-[1px] bg-neutral-500"></span>
    </button>
    <button
      @click="() => toggleSection('message')"
      id="__log-viewer__tab-section-message"
      :class="[
        globalStates.logs.partsShown.message ? '' : 'opacity-70',
        'shrink-0',
      ]"
    >
      message
    </button>
  </div>
</template>

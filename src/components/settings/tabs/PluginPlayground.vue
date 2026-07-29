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
import "prism-code-editor/prism/languages/javascript";
import "prism-code-editor/layout.css";
import "prism-code-editor/themes/github-dark.css";
import "prism-code-editor/autocomplete.css";
import "prism-code-editor/autocomplete-icons.css";

import { createEditor } from "prism-code-editor";
import {
  autoComplete,
  completeFromList,
  fuzzyFilter,
  registerCompletions,
} from "prism-code-editor/autocomplete";
import {
  completeKeywords,
  jsCompletion,
  jsContext,
  jsDocCompletion,
  jsSnipets,
} from "prism-code-editor/autocomplete/javascript";
import { cursorPosition } from "prism-code-editor/cursor";
import { indentGuides } from "prism-code-editor/guides";
import { computed, onMounted } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { AsyncFunction } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { codeOutput, codeToEvaluate } from "@/states/plugin-playground.ts";
import { serverProcesses } from "@/states/servers.ts";

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

async function handleCode(): Promise<void> {
  try {
    const userPlugin = new AsyncFunction(codeToEvaluate.value);

    codeOutput.value = await userPlugin();
  } catch (error: unknown) {
    const prettyError: string = Errors.prettify(error);

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to execute the code in playground:",
      prettyError,
    );
    codeOutput.value = prettyError;
  }
}

onMounted(() => {
  const editor = createEditor(
    "#__settings-page__plugin-playground-editor",
    {
      "language": "javascript",
      "wordWrap": true,
      "value"   : codeToEvaluate.value,
      "onUpdate": (input: string): void => {
        codeToEvaluate.value = input;
      },
    },
  );

  editor.addExtensions(
    cursorPosition(),
    indentGuides(),
    autoComplete({
      "filter"      : fuzzyFilter,
      "closeOnBlur" : true,
      "explicitOnly": false,
      "preferAbove" : false,
    }),
  );

  registerCompletions(["javascript", "js"], {
    "context": jsContext,
    "sources": [
      jsCompletion(window),
      completeKeywords,
      jsDocCompletion,
      completeFromList(jsSnipets),
    ],
  });
});
</script>

<template>
  <div
    id="__settings-page__plugin-playground-wrapper"
    class="h-full min-h-fit w-full flex flex-col gap-2 rounded-md p-2"
    :style="cardStyles"
  >
    <div
      id="__settings-page__plugin-playground-description"
      class="shrink-0 text-neutral-300"
    >
      A place where you can experiment with your Kaede plugins. Your code and output will be lost as soon as you reload the UI or close the launcher.
    </div>
    <div
      id="__settings-page__plugin-playground-active-zone"
      class="h-full w-full flex flex-wrap gap-2 text-sm sm:flex-nowrap"
    >
      <div
        id="__settings-page__plugin-playground-editor"
        class="h-full w-full overflow-hidden rounded-md outline-2 outline-neutral-300 outline-offset-2 [&>.prism-code-editor]:h-full focus-within:outline"
      ></div>
      <div
        id="__settings-page__plugin-playground-servers"
        class="w-full flex shrink-0 flex-col select-text gap-2 lg:w-80 sm:w-48"
      >
        <button
          id="__settings-page__plugin-playground-execute"
          @click="handleCode"
          class="relative w-full flex rounded-md bg-[#0d1117] p-2 text-neutral-300"
        >
          Execute the code
          <MaterialRipple />
        </button>
        <div
          id="__settings-page__plugin-playground-code-output"
          class="rounded-md bg-[#0d1117] p-2 text-neutral-300"
        >
          Output:
          <div
            id="__settings-page__plugin-playground-code-output-area"
            class="mt-1 min-h-6 whitespace-pre-wrap break-all rounded-md bg-[#171b22] p-1 text-xs text-white font-mono"
          >
            {{ codeOutput }}
          </div>
        </div>
        <div
          id="__settings-page__plugin-playground-server-header"
          class="rounded-md bg-[#0d1117] px-2 py-1 text-neutral-300"
        >
          Here is a list of
          <span id="__settings-page__plugin-playground-server-header-count" class="text-white">
            {{ serverProcesses.length }}
          </span>
          currently running servers
        </div>
        <div
          v-for="server in serverProcesses"
          :key="server.name"
          :id="`__settings-page__plugin-playground-server-wrapper-${server.name}`"
          class="flex flex-nowrap justify-between rounded-md bg-[#0d1117] p-1"
        >
          <div
            :id="`__settings-page__plugin-playground-server-info-${server.name}`"
            class="shrink-0 px-1"
          >
            {{ server.name }}
            <span
              :id="`__settings-page__plugin-playground-server-port-${server.name}`"
              class="shrink-0 text-neutral-400"
            >
            Port: {{ server.port }}
          </span>
          </div>
          <button
            :id="`__settings-page__plugin-playground-server-kill-button-${server.name}`"
            @click="() => {
              server.value.kill();
            }"
            class="flex hover:text-neutral-400"
          >
            <span
              :id="`__settings-page__plugin-playground-server-kill-icon-${server.name}`"
              class="i-lucide-x size-5 shrink-0"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

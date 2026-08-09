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
import type { DOMPurify } from "dompurify";
import type { marked as Marked } from "marked";

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Modrinth from "@/lib/modrinth";

const { idRoot, projectId } = defineProps<{
  "idRoot"   : string;
  "projectId": string;
}>();

const { styles } = useConfigColors();

const hook = (node: Element): void => {
  if (node.tagName === "A") {
    // Make all links open a new tab (browser tab in this case)
    node.setAttribute("target", "_blank");
  }
};

async function getUtilities(): Promise<{
  "marked": typeof Marked;
  "purify": DOMPurify;
}> {
  if (!GlobalObject.packages.marked || !GlobalObject.packages.purify) {
    const [marked, { "default": purify }] = await Promise.all([

      /*
       * These libraries are around 65 KBs minified,
       * so we load them only if the user expands the modpack body
       */
      import("marked"),
      import("dompurify"),
    ]);

    GlobalObject.packages.marked = marked;
    GlobalObject.packages.purify = purify;
  }

  return GlobalObject.packages as {
    "marked": typeof Marked;
    "purify": DOMPurify;
  };
}

const { data, status, error } = useQuery({
  "queryKey": [
    "modrinth",
    ModrinthAPI.ProjectType,
    projectId,
    "body",
  ],
  "queryFn": async (): Promise<string> => {
    const [body, { marked, purify }] = await Promise.all([
      Modrinth.getProjectBody(projectId),
      getUtilities(),
    ]);

    // The project body parsed to HTML
    const parsed: string = await marked.parse(body);

    purify.addHook("afterSanitizeAttributes", hook);

    // Example of the prevented XSS: '<img src=x onerror="alert(`hi`)">'
    const purified: string = purify.sanitize(parsed, {
      "ADD_ATTR": ["target"],
    });

    purify.removeHook("afterSanitizeAttributes", hook);

    return purified;
  },
});
</script>

<template>
  <div
    :id="idRoot"
    class="rounded-md text-sm bg-[theme(colors.neutral.100/.05)]"
    :style="styles.widgetSecondary"
  >
    <div
      v-if="data"
      :id="`${idRoot}-parsed-body`"
      class="__marked-parsed-body"
      v-html="data"
    />
    <div
      v-else-if="status !== 'error'"
      class="p-4"
      :id="`${idRoot}-pending`"
    >
      <div :id="`${idRoot}-pending-icon`" class="i-lucide-loader-circle animate-spin"></div>
    </div>
    <div
      v-else
      class="p-4"
      :id="`${idRoot}-error`"
    >
      An error occurred: {{ error }}
    </div>
  </div>
</template>

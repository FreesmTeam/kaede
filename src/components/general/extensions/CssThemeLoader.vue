<script setup lang="ts">
import { type DirEntry, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { onMounted, onUnmounted, shallowReactive } from "vue";

import { CSSThemeExtensions } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import type { CustomThemeType } from "@/types/extensions/custom-theme.type.ts";

const stylesheets = shallowReactive<{
  "applied" : Array<CustomThemeType>;
  "disabled": Array<CustomThemeType["id"]>;
}>({ "applied": [], "disabled": [] });

const cleanup: Array<() => void> = [];

async function transformToPromise(path: string, filename: string): Promise<CustomThemeType> {
  const filePath = FileManager.join(path, filename);

  log.debug(__PRE_BUNDLED_FILENAME__, `Reading the '${filename}' theme in the 'themes' folder`);
  const fileCode = await readTextFile(filePath);

  return {
    "id"     : filename.slice(0, -1 * CSSThemeExtensions.Enabled.length),
    "content": fileCode,
  };
}

onMounted(async () => {
  try {
    const path = FileManager.join(
      FileManager.getBaseDirectory(),
      FileStructure.Folders.Themes.Path,
    );

    log.debug(__PRE_BUNDLED_FILENAME__, "Reading the 'themes' folder");
    const storedThemes: Array<DirEntry> = await readDir(path);
    const actualThemeFiles: Array<string> = [];
    const disabledThemeFiles: Array<string> = [];

    for (const stored of storedThemes) {
      if (!stored.isFile) {
        continue;
      }

      if (stored.name.endsWith(CSSThemeExtensions.Enabled)) {
        actualThemeFiles.push(stored.name);

        continue;
      }

      if (stored.name.endsWith(CSSThemeExtensions.Disabled)) {
        disabledThemeFiles.push(stored.name);
      }
    }

    stylesheets.disabled = disabledThemeFiles.map(filename => filename.slice(
      0,
      -1 * CSSThemeExtensions.Disabled.length,
    ));
    stylesheets.applied = await Promise.all(
      actualThemeFiles.map(filename => (
        transformToPromise(path, filename)
      )),
    );
  } catch (error: unknown) {
    log.error(__PRE_BUNDLED_FILENAME__, "Could not load all CSS themes:", Errors.prettify(error));
  }

  if (stylesheets.applied.length === 0) {
    log.debug(__PRE_BUNDLED_FILENAME__, "User does not have any custom CSS themes");

    return;
  }

  for (const { id, content } of stylesheets.applied) {
    log.debug(__PRE_BUNDLED_FILENAME__, `Applying CSS styles of the '${id}' theme`);
    const stylesheet = document.createElement("style");

    stylesheet.textContent = content;

    document.head.append(stylesheet);

    cleanup.push(() => stylesheet.remove());
  }

  log.info(__PRE_BUNDLED_FILENAME__, `Custom CSS themes applied: ${stylesheets.applied.length}`);
});

onUnmounted(() => {
  for (const callback of cleanup) {
    callback();
  }
});
</script>

<template>
  <div id="__css-themes-loader__wrapper"></div>
</template>

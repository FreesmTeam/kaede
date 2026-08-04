/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { type ShallowReactive, watchEffect } from "vue";

import Configs from "@/lib/configs";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { CleanupType } from "@/types/watchers/cleanup.type.ts";

const reload = (event: KeyboardEvent): void => {
  const allow: boolean = globalStates.development.enableNativeReloadKeyBinds;

  if (allow) {
    return;
  }

  if (
    event.key === "F5" ||
    (event.ctrlKey && event.key === "r") ||
    (event.metaKey && event.key === "r")
  ) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "Prevented native behaviour when triggering reload key binds",
    );
    event.preventDefault();
  }
};

export function watchDevelopmentStates(): CleanupType<GlobalStatesType["development"]> {
  const cleanup: CleanupType<GlobalStatesType["development"]> = {};

  cleanup.enableDebugMode = watchEffect(() => {
    const enabled: boolean = globalStates.development.enableDebugMode;
    const field = enabled ? "__debug-defined" : "__debug-undefined";

    log.debug = log[field];
  });

  window.addEventListener("keydown", reload);
  cleanup.enableNativeReloadKeyBinds = (): void => window.removeEventListener("keydown", reload);

  return cleanup;
}

/**
 * Updates translations on locale change.
 */
export function watchLocaleStates(): () => void {
  return watchEffect(async () => {
    const baseDirectory: string = FileManager.getBaseDirectory();
    const locale: string = globalStates.locale;

    log.debug(__PRE_BUNDLED_FILENAME__, `Overriding default translations to '${locale}'`);
    globalStates.translations = await Configs.getTranslations({
      baseDirectory,
      "selected": locale,
    });
    log.info(__PRE_BUNDLED_FILENAME__, `Successfully set translations to '${locale}'`);
  });
}

export function watchLogModeStates(logs: ShallowReactive<Record<string, {
  "list": Array<string>;
}>>): () => void {
  // We want to display only defined logs
  return watchEffect(() => {
    const currentMode: string = globalStates.logs.mode;

    // So we exclude 'kaede-launcher' as it is always defined
    if (currentMode === "kaede-launcher") {
      return;
    }

    // If the currently displayed logs are defined, then we do not care
    if (logs[currentMode] !== undefined) {
      return;
    }

    // If they are undefined, we fall back to launcher logs
    globalStates.logs.mode = "kaede-launcher";
  });
}

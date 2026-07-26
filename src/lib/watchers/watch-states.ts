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

import { watchEffect } from "vue";

import Configs from "@/lib/configs";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesDevelopmentType,
  GlobalStatesLayoutType,
} from "@/types/application/global-states.type.ts";
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

export function watchDevelopmentStates(): CleanupType<GlobalStatesDevelopmentType> {
  const cleanup: CleanupType<GlobalStatesDevelopmentType> = {};

  cleanup.enableDebugMode = watchEffect(() => {
    const enabled: boolean = globalStates.development.enableDebugMode;
    const field = enabled ? "__debug-defined" : "__debug-undefined";

    log.debug = log[field];
  });

  window.addEventListener("keydown", reload);
  cleanup.enableNativeReloadKeyBinds = (): void => window.removeEventListener("keydown", reload);

  return cleanup;
}

export function watchLayoutStates(): CleanupType<GlobalStatesLayoutType> {
  const cleanup: CleanupType<GlobalStatesLayoutType> = {};

  /**
   * Updates translations on locale change.
   */
  cleanup.locale = watchEffect(async () => {
    const baseDirectory: string = General.getBaseDirectory();
    const locale: string = globalStates.layout.locale;

    log.debug(__PRE_BUNDLED_FILENAME__, `Overriding default translations to '${locale}'`);
    globalStates.translations = await Configs.getTranslations({
      baseDirectory,
      "selected": locale,
    });
    log.info(__PRE_BUNDLED_FILENAME__, `Successfully set translations to '${locale}'`);
  });

  return cleanup;
}

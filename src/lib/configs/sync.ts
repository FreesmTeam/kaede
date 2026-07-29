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

import { writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

let lastWritten: string;

export async function sync(): Promise<void> {
  if (lastWritten === undefined) {
    lastWritten = JSON.stringify(GlobalInternals.initialConfig);
  }

  const startTime: number = performance.now();

  const currentConfigStates: ConfigType = {
    "development": globalStates.development,
    "extensions" : globalStates.extensions,
    "ui"         : globalStates.ui,
    "selected"   : globalStates.selected,
    "locale"     : globalStates.locale,
    "minecraft"  : globalStates.minecraft,
    "logs"       : {
      ...globalStates.logs,
      // Make 'logs.show' always false so that the user won't see log viewer on app launch
      "show": false,
    },
  };

  const currentConfigStatesStringy: string = JSON.stringify(currentConfigStates);

  if (lastWritten === currentConfigStatesStringy) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "Seems like config didn't change. No need for config sync",
    );

    return;
  }

  const configPath = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Files.Config,
  );

  try {
    await writeTextFile(
      configPath,
      JSON.stringify(currentConfigStates, null, 2),
    );
    lastWritten = currentConfigStatesStringy;
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to sync the config file:",
      Errors.prettify(error),
    );
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Config file successfully synced in:",
    (performance.now() - startTime).toFixed(1),
    "ms",
  );
}

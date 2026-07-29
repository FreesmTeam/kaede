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

import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function ensureMinecraftDirectory(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const logPrefix: string = necessaries.logPrefix;
  const directory: string = necessaries.directories.instance;

  log.debug(
    logPrefix,
    `Checking if the minecraft directory exists (${directory})`,
  );
  const directoryExists: boolean = await exists(directory);

  if (!directoryExists) {
    log.warn(
      logPrefix,
      `The minecraft directory does not exist; creating it (${directory})`,
    );
    await mkdir(directory, {
      "recursive": true,
    });
  }
}

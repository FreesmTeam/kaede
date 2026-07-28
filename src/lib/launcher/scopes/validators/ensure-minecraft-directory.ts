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

import { Host } from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
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
  const isDirectoryPresent: boolean = await Host.files.exists(directory);

  if (!isDirectoryPresent) {
    log.warn(
      logPrefix,
      `The minecraft directory does not exist; creating it (${directory})`,
    );
    await Host.files.ensureDirectories([directory], { "recursive": true });
  }
}

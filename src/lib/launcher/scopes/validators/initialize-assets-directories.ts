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

import { GlobalObject } from "@/extendable/global-object.ts";
import { Host } from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function initializeAssetsDirectories(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const { directories, logPrefix } = necessaries;

  log.debug(
    logPrefix,
    "Checking if '/assets/indexes/' and '/assets/objects/' exist",
  );
  const [indexesExists, objectsExists] = await Host.files.existsMany([
    directories.assetIndexes,
    directories.assetObjects,
  ]);

  if (!indexesExists && !objectsExists) {
    log.debug(
      logPrefix,
      "Initializing the '/assets/indexes/' and '/assets/objects/' directories",
    );
    await Host.files.ensureDirectories([directories.assetIndexes, directories.assetObjects]);

    return GlobalObject.libs.Launcher.Validators.initializeShortHashDirectories(necessaries);
  }

  if (!indexesExists) {
    log.debug(
      logPrefix,
      "Initializing the '/assets/indexes/' directory",
    );
    await Host.files.ensureDirectories([directories.assetIndexes]);

    return GlobalObject.libs.Launcher.Validators.initializeShortHashDirectories(necessaries);
  }

  if (!objectsExists) {
    log.debug(logPrefix, "Initializing the '/assets/objects/' directory");
    await Host.files.ensureDirectories([directories.assetObjects]);

    return GlobalObject.libs.Launcher.Validators.initializeShortHashDirectories(necessaries);
  }

  log.info(
    logPrefix,
    "The '/assets/indexes/' and '/assets/objects/' directories exist",
  );

  return GlobalObject.libs.Launcher.Validators.initializeShortHashDirectories(necessaries);
}

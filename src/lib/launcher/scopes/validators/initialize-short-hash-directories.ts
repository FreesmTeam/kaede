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

import { type DirectoryEntry, Host } from "@/lib/capability-broker";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const shortHashes: Array<string> = Array
  .from(
    { "length": 256 },
    (_, index) => index.toString(16).padStart(2, "0"),
  );

export async function initializeShortHashDirectories({
  directories,
  logPrefix,
}: PreLaunchInformationType): Promise<void> {
  log.debug(logPrefix, "Reading the '/assets/objects' directory");
  const objects: ReadonlyArray<DirectoryEntry> = await Host.files.readDirectory(
    directories.assetObjects,
  );
  const existingFolders: Set<string> = new Set(
    objects.map(({ name }) => name),
  );
  const missingPaths = shortHashes
    .filter(hash => !existingFolders.has(hash))
    .map(hash => General.cachedJoin(directories.assetObjects, hash));

  if (missingPaths.length === 0) {
    return;
  }

  log.warn(
    logPrefix,
    `Missing ${missingPaths.length} short hash directories; creating them`,
  );
  await Host.files.ensureDirectories(missingPaths);
}

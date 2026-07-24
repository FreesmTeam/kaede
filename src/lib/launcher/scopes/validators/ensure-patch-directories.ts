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

import FileStructure from "@/constants/file-structure.ts";
import { CustomPatches, PatchUIDs } from "@/constants/meta.ts";
import { Host } from "@/lib/capability-broker";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const customPatchUIDs = Object.values(CustomPatches);

export async function ensurePatchDirectories(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const { directories, logPrefix } = necessaries;
  const actualPatchUIDs: Array<ExtendedPatchUIDType> = [
    ...PatchUIDs,
    ...customPatchUIDs,
  ];

  log.debug(
    logPrefix,
    `Checking if ${actualPatchUIDs.length} patch directories exist`,
  );
  const patchPaths = actualPatchUIDs.map(uid => General.cachedJoin(
    directories.base,
    FileStructure.Folders.Cache.Path,
    uid,
  ));
  const existStatuses = await Host.files.existsMany(patchPaths);
  const toCreate: Array<string> = [];

  for (const [index, status] of existStatuses.entries()) {
    if (status) {
      continue;
    }

    toCreate.push(
      General.cachedJoin(
        directories.base,
        FileStructure.Folders.Cache.Path,
        actualPatchUIDs[index],
      ),
    );
  }

  log.debug(
    logPrefix,
    `Missing patch directories: ${toCreate.join(", ")}`,
  );
  await Host.files.ensureDirectories(toCreate);
}

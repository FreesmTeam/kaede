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

import { resolvePatch } from "@/lib/launcher/scopes/patches/resolve-patch.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolveSubPatches({
  necessaries,
  patchMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "patchMeta"  : SpecificPatchMetaType;
}): Promise<Array<SpecificPatchMetaType>> {
  const toResolve: Array<Array<PatchDependencyType> | undefined> = [patchMeta?.requires];
  const patches: Array<SpecificPatchMetaType> = [patchMeta];

  for (const currentGroup of toResolve) {
    if (currentGroup === undefined) {
      continue;
    }

    const currentResolved: Array<SpecificPatchMetaType | false> = await Promise.all(
      currentGroup.map(required => resolvePatch({
        "metadata": required,
        necessaries,
        patchMeta,
      })),
    );

    for (const resolvedPatch of currentResolved) {
      if (resolvedPatch === false) {
        continue;
      }

      patches.push(resolvedPatch);
      toResolve.push(resolvedPatch.requires);
    }
  }

  return patches;
}

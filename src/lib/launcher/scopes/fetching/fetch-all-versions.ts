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

import { APIEndpoints } from "@/constants/launcher.ts";
import { CustomPatches, Patches } from "@/constants/meta.ts";
import { Host } from "@/lib/capability-broker";
import type {
  ExtendedPatchUIDType,
  PatchDependencyType,
  PatchIndexVersionType,
} from "@/types/launcher/meta/patch-index.type.ts";

export async function fetchAllVersions(
  uid: ExtendedPatchUIDType,
  minecraftPatchVersion?: string,
): Promise<Array<PatchIndexVersionType>> {
  // TODO: write OptiFine fetch as a normal human being (use Github API)
  if (uid === CustomPatches.OptiFine) {
    if (minecraftPatchVersion !== "1.18.1") {
      return [];
    }

    return [
      {
        "version"    : "1.18.1_HD_U_H4",
        "sha256"     : "ded4bce642d13441f9a5a555963ae57b8e9c03c8f359c321d9387c3693cca05d",
        "releaseTime": "2021-12-12T00:00:00.000Z",
        "recommended": false,
        "requires"   : [
          {
            "uid"   : Patches.Minecraft,
            "equals": "1.18.1",
          },
        ],
      },
    ];
  }

  const url: string = APIEndpoints.Meta.Base + uid;
  const response: Response = await Host.http.fetch(url);
  const parsed: unknown = await response.json();

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The provided metadata is invalid");
  }

  if (!("versions" in parsed) || !Array.isArray(parsed.versions)) {
    throw new Error("No versions in the provided metadata");
  }

  const entry: unknown = parsed.versions?.[0];

  if (typeof entry !== "object" || entry === null) {
    throw new Error("The parsed versions are invalid");
  }

  if (!("version" in entry)) {
    throw new Error("No version field in the parsed versions");
  }

  if (minecraftPatchVersion && uid !== Patches.Minecraft) {
    return parsed.versions.filter(currentVersion => {
      const requires: Array<PatchDependencyType> =
        currentVersion?.requires ?? [];

      for (const require of requires) {
        const neededVersion: string | undefined =
          require?.equals || require?.suggests;

        if (neededVersion === undefined) {
          continue;
        }

        if (neededVersion !== minecraftPatchVersion) {
          return false;
        }
      }

      return true;
    });
  }

  return parsed.versions;
}

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

import { fetch } from "@tauri-apps/plugin-http";

import { APIEndpoints } from "@/constants/launcher.ts";
import { CustomPatches, Patches } from "@/constants/meta.ts";
import type {
  ExtendedPatchUIDType,
  PatchDependencyType,
  PatchIndexVersionType,
} from "@/types/launcher/meta/patch-index.type.ts";

type BMCLAPIOptiFineType = Partial<{
  "_id"      : string;
  "mcversion": string;
  "patch"    : string;
  "type"     : string;
  "__v"      : number;
  "filename" : string;
  "forge"    : string;
}>;

export async function fetchAllVersions(
  uid: ExtendedPatchUIDType,
  minecraftPatchVersion?: string,
): Promise<Array<PatchIndexVersionType>> {
  if (uid === CustomPatches.OptiFine) {
    // Example: 'https://bmclapi2.bangbang93.com/optifine/1.8.9'
    const versionEndpoint: string =
      APIEndpoints.BMCLAPI.Base +
      APIEndpoints.BMCLAPI.Paths.OptiFine.Base +
      minecraftPatchVersion;

    const response: Response = await fetch(versionEndpoint);
    const data: unknown = await response.json();

    /*
     * BMCLAPI answers with '{ "msg": "no such optifine" }' when it knows nothing
     * about a Minecraft version, so this cannot be assumed to be an array
     */
    if (!Array.isArray(data)) {
      throw new TypeError(`No OptiFine versions for Minecraft ${minecraftPatchVersion}`);
    }

    // Reverse as it seems like first entries are the oldest ones
    return (data as Array<BMCLAPIOptiFineType>).reverse().map(entry => ({
      "version"    : `${entry?.mcversion ?? minecraftPatchVersion}_${entry?.type}_${entry?.patch}`,
      "sha256"     : "",
      "releaseTime": "1970-01-01T00:00:00Z",
      "recommended": false,
      "requires"   : [
        {
          "uid"   : Patches.Minecraft,
          "equals": minecraftPatchVersion,
        },
      ],
    }));
  }

  const url: string = APIEndpoints.Meta.Base + uid;
  const response: Response = await fetch(url);
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

  if (uid !== Patches.Minecraft && minecraftPatchVersion) {
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
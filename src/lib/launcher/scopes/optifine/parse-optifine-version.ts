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

import type { ParsedOptiFineVersionType } from "@/types/launcher/optifine/parsed-version.type.ts";

/*
 * 'Fetching#fetchAllVersions' returns OptiFine versions as
 * '${mcversion}_${type}_${patch}', but BMCLAPI needs those three parts
 * as separate URL parts:
 *
 * - '1.8.9_HD_U_M5'          -> '1.8.9', 'HD_U', 'M5'
 * - '1.21.4_HD_U_J3_pre14'   -> '1.21.4', 'HD_U_J3', 'pre14'
 */
export function parseOptiFineVersion(version: string): ParsedOptiFineVersionType | false {
  const firstSeparator: number = version.indexOf("_");
  const lastSeparator : number = version.lastIndexOf("_");

  if (firstSeparator === -1 || firstSeparator === lastSeparator) {
    return false;
  }

  const minecraftVersion: string = version.slice(0, firstSeparator);
  const type: string = version.slice(firstSeparator + 1, lastSeparator);
  const patch: string = version.slice(lastSeparator + 1);

  if (!minecraftVersion || !type || !patch) {
    return false;
  }

  return { minecraftVersion, type, patch };
}

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

import { ModrinthAPI } from "@/constants/modrinth.ts";

export async function fetchVersion(projectId: string): Promise<Array<{
  "id"            : string;
  "featured"      : boolean;
  "game_versions" : Array<string>;
  "loaders"       : Array<"fabric" | "forge" | "minecraft">;
  "name"          : string;
  "version_number": string;
  "files"         : Array<Partial<{
    "id"    : string;
    "hashes": {
      "sha1"  : string;
      "sha512": string;
    };
    // The '.mrpack' file
    "url"      : string;
    "filename" : string;
    "primary"  : boolean;
    "size"     : number;
    "file_type": null;
  }>>;
}>> {
  const response: Response = await fetch(`${ModrinthAPI.Endpoints.Project}/${projectId}/version`);

  if (!response.ok) {
    throw new Error(`Modrinth answered with the status ${response.status}`);
  }

  const parsed = await response.json();

  if (!Array.isArray(parsed)) {
    throw new TypeError("Modrinth returned an invalid project version response");
  }

  return parsed;
}
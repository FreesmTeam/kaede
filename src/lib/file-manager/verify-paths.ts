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

import { invoke } from "@tauri-apps/api/core";

export function verifyPaths({
  paths,
  sha1,
}: {
  "paths": Array<{ "path": string; "hash": string }>;
  "sha1"?: boolean;
}): Promise<Array<string>> {
  if (sha1) {
    return invoke("verify_file_paths", {
      "artifacts": paths,
    });
  }

  return invoke("get_missing_files", {
    "paths": paths.map(({ path }) => path),
  });
}

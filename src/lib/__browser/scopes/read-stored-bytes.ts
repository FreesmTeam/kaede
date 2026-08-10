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

import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";
import { toBinaryContents } from "@/lib/browser/scopes/to-binary-contents.ts";

// Returns 'undefined' when the path does not exist in the browser storage
export async function readStoredBytes(path: string): Promise<Uint8Array | undefined> {
  const value: string | File = await readStoragePath(path);

  // 'readStoragePath' collapses missing files into empty strings
  if (value === "") {
    return undefined;
  }

  return toBinaryContents(value);
}

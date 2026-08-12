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

/**
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

import { listStores } from "@/lib/browser/scopes/list-stores.ts";

type DirectoryEntryType = {
  "name"       : string;
  "isDirectory": boolean;
  "isFile"     : boolean;
  "isSymlink"  : boolean;
};

/*
 * A replica of 'plugin:fs|read_dir'. The browser storage is flat
 * (full paths as keys), so directory entries are derived from the
 * path segment that follows the requested directory prefix
 */
export async function listDirectoryEntries(path: string): Promise<Array<DirectoryEntryType>> {
  const prefix: string = path.endsWith("/") ? path : `${path}/`;
  const keys: Array<string> = await listStores(prefix);
  // The entry name is mapped to whether that entry is a directory
  const entries: Map<string, boolean> = new Map;

  for (const key of keys) {
    const rest: string = key.slice(prefix.length);

    if (rest.length === 0) {
      continue;
    }

    const separatorIndex: number = rest.indexOf("/");

    if (separatorIndex === -1) {
      entries.set(rest, entries.get(rest) ?? false);

      continue;
    }

    entries.set(rest.slice(0, separatorIndex), true);
  }

  return [...entries.entries()].map(([name, isDirectory]) => ({
    name,
    isDirectory,
    "isFile"   : !isDirectory,
    "isSymlink": false,
  }));
}

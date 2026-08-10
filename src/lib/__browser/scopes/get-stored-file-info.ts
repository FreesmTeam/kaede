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

import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";

/*
 * '@tauri-apps/plugin-fs' parses this exact shape in 'parseFileInfo',
 * so every field has to be present even when it makes no sense in a browser
 */
type StoredFileInfoType = {
  "isFile"        : boolean;
  "isDirectory"   : boolean;
  "isSymlink"     : boolean;
  "size"          : number;
  "mtime"         : number | null;
  "atime"         : number | null;
  "birthtime"     : number | null;
  "readonly"      : boolean;
  "fileAttributes": number | null;
  "dev"           : number | null;
  "ino"           : number | null;
  "mode"          : number | null;
  "nlink"         : number | null;
  "uid"           : number | null;
  "gid"           : number | null;
  "rdev"          : number | null;
  "blksize"       : number | null;
  "blocks"        : number | null;
};

// A replica of 'plugin:fs|stat' on top of the browser storage
export async function getStoredFileInfo(path: string): Promise<StoredFileInfoType> {
  const keys: Array<string> = await listStores(path);
  const isFile: boolean = keys.includes(path);
  const isDirectory: boolean = !isFile && keys.some(key => key.startsWith(`${path}/`));

  if (!isFile && !isDirectory) {
    throw `Failed to get metadata of ${path}: it does not exist in the browser storage`;
  }

  let size: number = 0;
  let modified: number | null = null;

  if (isFile) {
    const value: string | File = await readStoragePath(path);

    if (typeof value === "string") {
      // 'String#length' counts UTF-16 units while 'Blob#size' counts bytes
      size = (new Blob([value])).size;
    } else {
      size = value.size;
      modified = value.lastModified;
    }
  }

  return {
    isFile,
    isDirectory,
    "isSymlink"     : false,
    size,
    "mtime"         : modified,
    "atime"         : null,
    "birthtime"     : null,
    "readonly"      : false,
    "fileAttributes": null,
    "dev"           : null,
    "ino"           : null,
    "mode"          : null,
    "nlink"         : null,
    "uid"           : null,
    "gid"           : null,
    "rdev"          : null,
    "blksize"       : null,
    "blocks"        : null,
  };
}

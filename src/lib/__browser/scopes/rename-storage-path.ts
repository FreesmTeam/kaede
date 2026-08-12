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

import { deleteStoragePath } from "@/lib/browser/scopes/delete-storage-path.ts";
import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

async function moveStoredValue(from: string, to: string): Promise<void> {
  const value: string | File = await readStoragePath(from);

  await writeToStoragePath(to, value);
  await deleteStoragePath(from);
}

export async function renameStoragePath(oldPath: string, newPath: string): Promise<void> {
  const keys: Array<string> = await listStores(oldPath);

  if (keys.includes(oldPath)) {
    return moveStoredValue(oldPath, newPath);
  }

  // The store has no directory records, so a directory is renamed key by key
  const prefix: string = `${oldPath}/`;
  const children: Array<string> = keys.filter(key => key.startsWith(prefix));

  if (children.length === 0) {
    throw `Failed to rename ${oldPath}: it does not exist in the browser storage`;
  }

  for (const key of children) {
    await moveStoredValue(key, `${newPath}/${key.slice(prefix.length)}`);
  }
}

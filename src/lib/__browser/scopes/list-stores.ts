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

import { BrowserStorageStoreKey } from "@/constants/browser.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";

export async function listStores(path?: string): Promise<Array<string>> {
  const database: IDBDatabase | undefined = GlobalInternals.indexedDB;

  if (!database) {
    return [];
  }

  const store: IDBObjectStore = getDatabaseStore(BrowserStorageStoreKey, database);
  const request = store.getAllKeys();

  return new Promise(resolve => {
    request.addEventListener("success", (): void => {
      // All keys are string, so we type cast
      const keys: Array<string> = request.result as Array<string>;

      if (!path) {
        return resolve(keys);
      }

      resolve(keys.filter(filtering => filtering.startsWith(path)));
    }, { "once": true });
    request.addEventListener("error", () => {
      resolve([]);
    }, { "once": true });
  });
}
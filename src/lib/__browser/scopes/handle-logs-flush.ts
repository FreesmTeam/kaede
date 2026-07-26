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
import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";
import General from "@/lib/general";

let firstTime: boolean = true;

export function handleLogsFlush(): void {
  setInterval(async () => {
    const database: IDBDatabase | undefined = GlobalInternals.indexedDB;
    const currentLogs: Array<string> | undefined = GlobalInternals.logsInBrowser;

    if (!database || !currentLogs) {
      return;
    }

    const store: IDBObjectStore = getDatabaseStore(BrowserStorageStoreKey, database);
    const logsKey: string = General.cachedJoin(
      General.getCachedBaseDirectory(),
      FileStructure.Folders.Logs.Path,
      FileStructure.Folders.Logs.Files.LatestLog,
    );
    const logsRequest = store.get(logsKey);

    await new Promise((resolve, reject) => {
      logsRequest.addEventListener("success", (): void => {
        const storedLogs: string = logsRequest.result?.value ?? "";
        const parsedLogs: Array<string> = storedLogs.split("\n");

        parsedLogs.push(...currentLogs);
        store.put({
          "path" : logsKey,
          "value": firstTime
            ? currentLogs.join("\n")
            : parsedLogs.join("\n"),
        });

        firstTime = false;
        resolve(true);
      }, { "once": true });
      logsRequest.addEventListener("error", error => {
        reject(error);
      }, { "once": true });
    });

    currentLogs.length = 0;
  }, 500);
}
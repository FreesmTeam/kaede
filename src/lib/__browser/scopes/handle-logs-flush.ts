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
import {
  withBrowserLogOperation,
} from "@/lib/browser/scopes/browser-preview-io.ts";
import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";
import General from "@/lib/general";

const logFlushState = { "isFirstFlush": true };

export function handleLogsFlush(): void {
  setInterval(() => {
    void withBrowserLogOperation(async () => {
      const database: IDBDatabase | undefined = GlobalInternals.indexedDB;
      const currentLogs: Array<string> | undefined = GlobalInternals.logsInBrowser;

      if (!database || !currentLogs || currentLogs.length === 0) {
        return;
      }

      const pendingLogs = [...currentLogs];

      const store: IDBObjectStore = getDatabaseStore(BrowserStorageStoreKey, database);
      const logsKey: string = General.cachedJoin(
        General.getCachedBaseDirectory(),
        FileStructure.Folders.Logs.Path,
        FileStructure.Folders.Logs.Files.LatestLog,
      );
      const logsRequest = store.get(logsKey);

      await new Promise<void>((resolve, reject) => {
        logsRequest.addEventListener("success", (): void => {
          const storedLogs: string = logsRequest.result?.value ?? "";
          const parsedLogs: Array<string> = storedLogs === "" ? [] : storedLogs.split("\n");

          parsedLogs.push(...pendingLogs);
          const writeRequest = store.put({
            "path" : logsKey,
            "value": logFlushState.isFirstFlush
              ? pendingLogs.join("\n")
              : parsedLogs.join("\n"),
          });

          writeRequest.addEventListener("success", (): void => {
            logFlushState.isFirstFlush = false;
            currentLogs.splice(0, pendingLogs.length);
            resolve();
          }, { "once": true });
          writeRequest.addEventListener("error", error => {
            reject(error);
          }, { "once": true });
        }, { "once": true });
        logsRequest.addEventListener("error", error => {
          reject(error);
        }, { "once": true });
      });
    });
  }, 500);
}

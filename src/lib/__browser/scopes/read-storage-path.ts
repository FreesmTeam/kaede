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
import type {
  BrowserStorageReadResult,
} from "@/lib/browser/scopes/browser-storage.ts";
import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";

const MISSING_STORAGE_VALUE: BrowserStorageReadResult = Object.freeze({
  "kind": "missing",
});

export async function readStoragePath(path: string): Promise<string> {
  const result = await readStorageValue(path);

  if (result.kind === "missing") {
    return "";
  }

  return typeof result.value === "string"
    ? result.value
    : (new TextDecoder).decode(result.value);
}

export async function readStorageValue(path: string): Promise<BrowserStorageReadResult> {
  const database: IDBDatabase | undefined = GlobalInternals.indexedDB;

  if (!database) {
    throw new Error("IndexedDB is unavailable in browser preview");
  }

  const store: IDBObjectStore = getDatabaseStore(BrowserStorageStoreKey, database);
  const request = store.get(path);

  return new Promise((resolve, reject) => {
    request.addEventListener("success", (): void => {
      const record: unknown = request.result;

      if (record === undefined) {
        resolve(MISSING_STORAGE_VALUE);

        return;
      }

      if (typeof record !== "object" || record === null) {
        reject(new Error(`Corrupt browser storage record: ${JSON.stringify(path)}`));

        return;
      }

      const value: unknown = Reflect.get(record, "value");

      if (typeof value === "string") {
        resolve(Object.freeze({ "kind": "value", value }));
      } else if (value instanceof Uint8Array) {
        resolve(Object.freeze({ "kind": "value", "value": Uint8Array.from(value) }));
      } else if (value instanceof ArrayBuffer) {
        resolve(Object.freeze({
          "kind" : "value",
          "value": Uint8Array.from(new Uint8Array(value)),
        }));
      } else {
        reject(new Error(`Unsupported browser storage value: ${JSON.stringify(path)}`));
      }
    }, { "once": true });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("An error occurred while reading from IndexedDB"));
    }, { "once": true });
  });
}

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { handleDatabase } from "@/lib/browser/scopes/handle-database.ts";
import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { readStorageValue } from "@/lib/browser/scopes/read-storage-path.ts";
import { removeStoragePath } from "@/lib/browser/scopes/remove-storage-path.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

export type BrowserStorageValue = string | Uint8Array;
export type BrowserStorageReadResult =
  | Readonly<{ "kind": "missing" }>
  | Readonly<{ "kind": "value"; "value": BrowserStorageValue }>;

export interface BrowserStorage {
  keys(): Promise<ReadonlyArray<string>>;
  read(path: string): Promise<BrowserStorageReadResult>;
  write(path: string, value: BrowserStorageValue): Promise<void>;
  remove(path: string): Promise<void>;
}

export async function createBrowserStorage(): Promise<BrowserStorage> {
  const { database } = await handleDatabase();

  if (database === undefined) {
    throw new Error("IndexedDB is unavailable in browser preview");
  }

  GlobalInternals.indexedDB = database;

  return Object.freeze({
    "keys"  : listStores,
    "read"  : readStorageValue,
    "write" : writeToStoragePath,
    "remove": removeStoragePath,
  });
}

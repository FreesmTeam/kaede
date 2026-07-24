import { BrowserStorageStoreKey } from "@/constants/browser.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";

export async function removeStoragePath(path: string): Promise<void> {
  const database = GlobalInternals.indexedDB;

  if (database === undefined) {
    throw new Error("IndexedDB is unavailable in browser preview");
  }

  const request = getDatabaseStore(BrowserStorageStoreKey, database).delete(path);

  return new Promise((resolve, reject) => {
    request.addEventListener("success", (): void => resolve(), { "once": true });
    request.addEventListener("error", (): void => {
      reject(request.error ?? new Error("An error occurred while deleting from IndexedDB"));
    }, { "once": true });
  });
}

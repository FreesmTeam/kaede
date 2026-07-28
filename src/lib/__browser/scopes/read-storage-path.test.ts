import { afterEach, expect, test } from "vitest";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { readStorageValue } from "@/lib/browser/scopes/read-storage-path.ts";

const originalDatabase = GlobalInternals.indexedDB;

function installIndexedDatabaseResult(result?: unknown): void {
  const request = new EventTarget;
  const objectStore = Object.freeze({
    "get": () => {
      queueMicrotask(() => request.dispatchEvent(new Event("success")));

      return request;
    },
  });
  const transaction = Object.freeze({
    "objectStore": () => objectStore,
  });
  const database = Object.freeze({
    "transaction": () => transaction,
  });

  Reflect.set(request, "result", result);
  Reflect.set(request, "error", null);
  Reflect.set(GlobalInternals, "indexedDB", database);
}

afterEach(() => {
  if (originalDatabase === undefined) {
    Reflect.deleteProperty(GlobalInternals, "indexedDB");
  } else {
    GlobalInternals.indexedDB = originalDatabase;
  }
});

test("IndexedDB reads distinguish a missing key from an unsupported existing value", async () => {
  installIndexedDatabaseResult();

  await expect(readStorageValue("missing")).resolves.toEqual({ "kind": "missing" });

  const unsupportedValue = Object.freeze({ "unexpected": true });
  const storedRecord = Object.freeze({ "path": "decision", "value": unsupportedValue });

  installIndexedDatabaseResult(storedRecord);
  await expect(readStorageValue("decision")).rejects.toThrow(
    "Unsupported browser storage value",
  );
  expect(storedRecord.value).toBe(unsupportedValue);
});

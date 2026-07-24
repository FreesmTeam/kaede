import { afterEach, expect, test, vi } from "vitest";

import { downloadToBrowserStorage } from "@/lib/browser/scopes/browser-preview-io.ts";
import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("failed HTTP download preserves the browser destination", async () => {
  const destinationPath = "indexed_db/libraries/client.jar";
  const existingBytes = Uint8Array.from([1, 2, 3]);
  const values = new Map<string, BrowserStorageValue>([
    [destinationPath, existingBytes],
  ]);
  const storage: BrowserStorage = Object.freeze({
    "keys": async () => [...values.keys()],
    "read": async (storagePath: string) => {
      const value = values.get(storagePath);

      return value === undefined
        ? Object.freeze({ "kind": "missing" as const })
        : Object.freeze({ "kind": "value" as const, value });
    },
    "write": async (storagePath: string, value: BrowserStorageValue) => {
      values.set(storagePath, value);
    },
    "remove": async (storagePath: string) => {
      values.delete(storagePath);
    },
  });
  const response = new Response(Uint8Array.from([4, 5, 6]), {
    "status"    : 404,
    "statusText": "Not Found",
  });
  const responseReader = vi.spyOn(response.body!, "getReader");
  const progress = vi.fn();

  const fetchMock = vi.fn(async (): Promise<Response> => response);

  vi.stubGlobal("fetch", fetchMock);

  await expect(downloadToBrowserStorage(
    storage,
    "https://example.test/missing.jar",
    destinationPath,
    progress,
  )).rejects.toThrow("HTTP download returned status 404 Not Found");

  expect(fetchMock).toHaveBeenCalledWith(
    "https://example.test/missing.jar",
    { "credentials": "omit" },
  );
  expect(responseReader).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
  expect(values.get(destinationPath)).toEqual(existingBytes);
});

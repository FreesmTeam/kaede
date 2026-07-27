import { afterEach, describe, expect, it, vi } from "vitest";

import { handleDatabase } from "@/lib/browser/scopes/handle-database.ts";

class IndexedDBOpenRequest extends EventTarget {
  error : DOMException | null = null;
  result: IDBDatabase | undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleDatabase", () => {
  it("rejects with the IndexedDB open error instead of hiding it", async () => {
    const request = new IndexedDBOpenRequest;
    const openError = new DOMException("database denied", "SecurityError");

    vi.stubGlobal("indexedDB", {
      "open": (): IDBOpenDBRequest => request as IDBOpenDBRequest,
    });

    const opening = handleDatabase();

    request.error = openError;
    request.dispatchEvent(new Event("error"));

    await expect(opening).rejects.toBe(openError);
  });
});

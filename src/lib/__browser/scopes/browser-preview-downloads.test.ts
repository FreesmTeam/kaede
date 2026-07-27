import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createBrowserDownloads,
} from "@/lib/browser/scopes/browser-preview-downloads.ts";
import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";

function createMemoryStorage(): Readonly<{
  "storage": BrowserStorage;
  "values" : Map<string, BrowserStorageValue>;
}> {
  const values = (new Map<string, BrowserStorageValue>);

  return Object.freeze({
    values,
    "storage": Object.freeze({
      "keys": async () => [...values.keys()],
      "read": async (path: string) => {
        const value = values.get(path);

        return value === undefined
          ? Object.freeze({ "kind": "missing" as const })
          : Object.freeze({ "kind": "value" as const, value });
      },
      "write": async (path: string, value: BrowserStorageValue) => {
        values.set(path, value);
      },
      "remove": async (path: string) => {
        values.delete(path);
      },
    }),
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser-preview download batches", () => {
  test("reports per-path progress and isolates failures from completed downloads", async () => {
    const { storage, values } = createMemoryStorage();
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      return requestUrl(input).endsWith("/missing")
        ? new Response("missing", { "status": 404, "statusText": "Not Found" })
        : new Response(Uint8Array.from([1, 2, 3, 4]), {
          "headers": { "content-length": "4" },
        });
    });
    const snapshots: Array<{
      "current": Readonly<Record<string, readonly [number, number]>>;
      "success": number;
      "failed" : number;
    }> = [];

    vi.stubGlobal("fetch", fetchMock);
    const report = await createBrowserDownloads(storage).batch({
      "entries": [
        { "url": "https://example.test/client", "path": "/game/client.jar" },
        { "url": "https://example.test/missing", "path": "/game/missing.jar" },
      ],
      "concurrency": 2,
      "label"      : "client",
      "cancelId"   : "client-downloads",
    }, snapshot => {
      snapshots.push(snapshot);
    });

    expect(report).toEqual({
      "success"  : 1,
      "failed"   : 1,
      "cancelled": false,
      "failures" : [{
        "url"  : "https://example.test/missing",
        "path" : "/game/missing.jar",
        "error": "HTTP download returned status 404 Not Found",
      }],
    });
    expect(values.get("/game/client.jar")).toEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(values.has("/game/missing.jar")).toBe(false);
    expect(snapshots.some(snapshot => {
      return snapshot.current["/game/client.jar"]?.[0] === 100;
    })).toBe(true);
    expect(snapshots[snapshots.length - 1])
      .toEqual({ "current": {}, "success": 1, "failed": 1 });
  });

  test("cancels only the matching active group and removes completed group handles", async () => {
    const { storage, values } = createMemoryStorage();
    const pending = (new Map<string, Readonly<{
      "resolve": (response: Response) => void;
      "signal" : AbortSignal;
    }>>);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      const signal = init?.signal;

      if (signal === undefined || signal === null) {
        throw new Error("Expected a group abort signal");
      }

      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", (): void => reject(signal.reason), { "once": true });
        pending.set(url, Object.freeze({ resolve, signal }));
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const downloads = createBrowserDownloads(storage);
    const first = downloads.batch({
      "entries"    : [{ "url": "https://example.test/first", "path": "/first" }],
      "concurrency": 1,
      "label"      : "first",
      "cancelId"   : "first-group",
    }, () => {});
    const second = downloads.batch({
      "entries"    : [{ "url": "https://example.test/second", "path": "/second" }],
      "concurrency": 1,
      "label"      : "second",
      "cancelId"   : "second-group",
    }, () => {});

    await vi.waitFor(() => expect(pending.size).toBe(2));
    await expect(downloads.cancel("unknown-group")).resolves.toBe(false);
    await expect(downloads.cancel("first-group")).resolves.toBe(true);
    expect(pending.get("https://example.test/first")?.signal.aborted).toBe(true);
    expect(pending.get("https://example.test/second")?.signal.aborted).toBe(false);
    await expect(first).resolves.toEqual({
      "success"  : 0,
      "failed"   : 0,
      "cancelled": true,
      "failures" : [],
    });

    pending.get("https://example.test/second")?.resolve(
      new Response(Uint8Array.from([9]), { "headers": { "content-length": "1" } }),
    );
    await expect(second).resolves.toEqual({
      "success"  : 1,
      "failed"   : 0,
      "cancelled": false,
      "failures" : [],
    });
    expect(values.get("/second")).toEqual(Uint8Array.from([9]));
    await expect(downloads.cancel("first-group")).resolves.toBe(false);
    await expect(downloads.cancel("second-group")).resolves.toBe(false);
  });

  test("shares cancellation across concurrent batches with the same group id", async () => {
    const { storage } = createMemoryStorage();
    const signals: Array<AbortSignal> = [];
    let rejectSecond: ((reason: unknown) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const signal = init?.signal;

      if (signal === undefined || signal === null) {
        throw new Error("Expected a shared group abort signal");
      }

      signals.push(signal);

      return new Promise((_resolve, reject) => {
        if (requestUrl(input).endsWith("/first")) {
          signal.addEventListener("abort", (): void => reject(signal.reason), { "once": true });
        } else {
          rejectSecond = reject;
        }
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const downloads = createBrowserDownloads(storage);
    const first = downloads.batch({
      "entries"    : [{ "url": "https://example.test/first", "path": "/first" }],
      "concurrency": 1,
      "label"      : "first",
      "cancelId"   : "shared-group",
    }, () => {});
    const second = downloads.batch({
      "entries"    : [{ "url": "https://example.test/second", "path": "/second" }],
      "concurrency": 1,
      "label"      : "second",
      "cancelId"   : "shared-group",
    }, () => {});

    await vi.waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]).toBe(signals[1]);
    await expect(downloads.cancel("shared-group")).resolves.toBe(true);
    await expect(first).resolves.toMatchObject({ "cancelled": true });
    await expect(downloads.cancel("shared-group")).resolves.toBe(true);

    rejectSecond?.(signals[1]?.reason);
    await expect(second).resolves.toMatchObject({ "cancelled": true });
    await expect(downloads.cancel("shared-group")).resolves.toBe(false);
  });
});

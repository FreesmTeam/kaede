import { afterEach, describe, expect, test, vi } from "vitest";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import {
  createBrowserHostFacade,
} from "@/lib/browser/scopes/browser-preview-host.ts";
import {
  BROWSER_RUNTIME_SNAPSHOT,
  createBrowserDirectHostFacade,
} from "@/lib/browser/scopes/browser-preview-runtime.ts";
import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";

type RuntimeHostHttp = Readonly<{
  fetch(input: unknown, init?: unknown): Promise<Response>;
}>;

const UNUSED_STORAGE: BrowserStorage = Object.freeze({
  "keys"  : async () => [],
  "read"  : async () => Object.freeze({ "kind": "missing" }),
  "write" : async () => {},
  "remove": async () => {},
});

afterEach(() => {
  GlobalInternals.logsInBrowser.length = 0;
  vi.unstubAllGlobals();
});

test("streams persisted, buffered, and future browser-preview logs until stopped", async () => {
  const logsPath = "indexed_db/logs/latest.log";
  const values = new Map<string, BrowserStorageValue>([
    [logsPath, "persisted-first\npersisted-second"],
  ]);
  const storage: BrowserStorage = Object.freeze({
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
  });
  const host = createBrowserHostFacade(
    storage,
    BROWSER_RUNTIME_SNAPSHOT,
    createBrowserDirectHostFacade(),
  );
  const events: Array<unknown> = [];

  GlobalInternals.logsInBrowser.push("buffered-third");
  await host.logs.stream(event => {
    events.push(event);
  });

  host.logs.write({ "level": "info", "message": "future-fourth", "location": "test" });

  expect(events).toHaveLength(2);
  expect(events[0]).toEqual({
    "type": "snapshot",
    "data": ["persisted-first", "persisted-second", "buffered-third"],
  });
  expect(events[1]).toMatchObject({ "type": "lines" });
  expect((events[1] as { "data": Array<string> }).data[0]).toContain("future-fourth");
  expect(await host.logs.stopStream()).toBe(true);

  host.logs.write({ "level": "warn", "message": "after-stop", "location": "test" });

  expect(events).toHaveLength(2);
  expect(await host.logs.stopStream()).toBe(false);
});

describe("browser-preview host HTTP", () => {
  const fallbackTestName =
    "uses explicit browser-preview fallbacks for native host metadata and diagnostics";

  test(fallbackTestName, async () => {
    const host = createBrowserHostFacade(
      UNUSED_STORAGE,
      BROWSER_RUNTIME_SNAPSHOT,
      createBrowserDirectHostFacade(),
    );

    await expect(host.files.getMetadata("/cache.json")).resolves.toEqual({
      "modifiedTimeMilliseconds": null,
    });
    await expect(host.diagnostics.getSystemMemory())
      .rejects.toThrow("system memory diagnostics");
    await expect(host.diagnostics.getGlobalCpuUsage())
      .rejects.toThrow("global CPU diagnostics");
  });

  test("returns an empty archive snapshot without native filesystem authority", async () => {
    const host = createBrowserHostFacade(
      UNUSED_STORAGE,
      BROWSER_RUNTIME_SNAPSHOT,
      createBrowserDirectHostFacade(),
    );

    await expect(host.extensions.readInstalledArchives()).resolves.toEqual({
      "extensions": [],
      "failures"  : [],
    });
  });

  test("keeps exact hashing available in browser preview without native IPC", async () => {
    const host = createBrowserHostFacade(
      UNUSED_STORAGE,
      BROWSER_RUNTIME_SNAPSHOT,
      createBrowserDirectHostFacade(),
    );

    await expect(host.hashes.md5(new Uint8Array)).resolves.toBe(
      "d41d8cd98f00b204e9800998ecf8427e",
    );
    await expect(host.hashes.sha256(new Uint8Array)).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("validates the narrowed contract and preserves credentialless responses", async () => {
    const nativeResponse = new Response("browser response", {
      "status"    : 401,
      "statusText": "Unauthorized",
    });
    let delegatedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      delegatedInit = init;

      return nativeResponse;
    });

    vi.stubGlobal("fetch", fetchMock);
    const http: RuntimeHostHttp = createBrowserHostFacade(
      UNUSED_STORAGE,
      BROWSER_RUNTIME_SNAPSHOT,
      createBrowserDirectHostFacade(),
    ).http;
    const url = new URL("https://example.test/resource");
    const init = Object.freeze({
      "method" : "POST",
      "headers": Object.freeze({ "x-test": "value" }),
      "body"   : "payload",
    });

    await expect(http.fetch(new Request(url))).rejects.toThrow(/does not accept Request input/u);
    await expect(http.fetch(url, { "redirect": "manual" }))
      .rejects.toThrow(/does not support field "redirect"/u);
    await expect(http.fetch(url, { "signal": (new AbortController).signal }))
      .rejects.toThrow(/does not support field "signal"/u);
    const response = await http.fetch(url, init);

    expect(response).toBe(nativeResponse);
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(url, {
      "body"       : "payload",
      "credentials": "omit",
      "headers"    : { "x-test": "value" },
      "method"     : "POST",
    });
    expect(Object.getPrototypeOf(delegatedInit ?? {})).toBeNull();
  });

  test("rejects polluted inherited options before native fetch", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => new Response);

    vi.stubGlobal("fetch", fetchMock);
    const http: RuntimeHostHttp = createBrowserHostFacade(
      UNUSED_STORAGE,
      BROWSER_RUNTIME_SNAPSHOT,
      createBrowserDirectHostFacade(),
    ).http;

    Object.defineProperties(Object.prototype, {
      "redirect": { "value": "manual", "configurable": true },
      "signal"  : { "value": (new AbortController).signal, "configurable": true },
    });
    try {
      await expect(http.fetch("https://example.test", {}))
        .rejects.toThrow(/does not support field "redirect"/u);
      Reflect.deleteProperty(Object.prototype, "redirect");
      await expect(http.fetch("https://example.test", {}))
        .rejects.toThrow(/does not support field "signal"/u);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(Object.prototype, "redirect");
      Reflect.deleteProperty(Object.prototype, "signal");
    }
  });
});

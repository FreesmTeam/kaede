import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createBrowserHostFacade,
} from "@/lib/browser/scopes/browser-preview-host.ts";
import {
  BROWSER_RUNTIME_SNAPSHOT,
  createBrowserDirectHostFacade,
} from "@/lib/browser/scopes/browser-preview-runtime.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";

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
  vi.unstubAllGlobals();
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

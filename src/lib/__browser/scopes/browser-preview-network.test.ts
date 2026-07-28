import { afterEach, expect, test, vi } from "vitest";

import type { BrowserGrantGuard } from "@/lib/browser/scopes/browser-preview-grants.ts";
import { fetchWithNetworkGrants } from "@/lib/browser/scopes/browser-preview-network.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const REQUIRE_NETWORK_GRANT: BrowserGrantGuard = () => [{
  "id"   : "network/http",
  "scope": {
    "origins": ["https://a.example.test", "https://b.example.test"],
    "methods": ["GET"],
  },
}];

test("omits ambient credentials on initial and redirected plugin requests", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    if (input === "https://a.example.test/redirect") {
      return new Response(null, {
        "status" : 307,
        "headers": { "location": "https://b.example.test/missing" },
      });
    }

    return new Response("not found", {
      "status"    : 404,
      "statusText": "Not Found",
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  const response = await fetchWithNetworkGrants({
    "url"    : "https://a.example.test/redirect",
    "method" : "GET",
    "headers": [],
  }, REQUIRE_NETWORK_GRANT);

  expect(response).toMatchObject({ "status": 404, "statusText": "Not Found" });
  expect(fetchMock).toHaveBeenNthCalledWith(1, "https://a.example.test/redirect", {
    "credentials": "omit",
    "headers"    : [],
    "method"     : "GET",
    "redirect"   : "manual",
  });
  expect(fetchMock).toHaveBeenNthCalledWith(2, "https://b.example.test/missing", {
    "credentials": "omit",
    "headers"    : [],
    "method"     : "GET",
    "redirect"   : "manual",
  });
});

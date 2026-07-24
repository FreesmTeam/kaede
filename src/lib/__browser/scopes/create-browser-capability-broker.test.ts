import { afterEach, expect, test, vi } from "vitest";

import {
  createMemoryStorage,
  grant,
  noEventCapability,
  principal,
} from "@/lib/browser/scopes/create-browser-capability-broker.test-helpers.ts";
import {
  createBrowserCapabilityBroker,
} from "@/lib/browser/scopes/create-browser-capability-broker.ts";
import { UnsupportedInBrowserPreviewError } from "@/lib/capability-broker/errors.ts";

afterEach(() => vi.unstubAllGlobals());

test("browser preview derives a complete initial state without desktop IPC", async () => {
  const runtime = await createBrowserCapabilityBroker(noEventCapability, createMemoryStorage());

  await expect(runtime.host.runtime.getInitialState()).resolves.toEqual({
    "basic": {
      "launcherVersion": "0.0.0",
      "baseDirectory"  : "indexed_db",
      "launchCount"    : 1,
      "separator"      : "/",
      "portable"       : false,
    },
    "parsed": {
      "config"      : { "status": "missing" },
      "accounts"    : { "status": "missing" },
      "instances"   : { "status": "missing" },
      "translations": { "status": "missing" },
    },
  });
});

test("browser download stores exact binary bytes and reports progress", async () => {
  const storage = createMemoryStorage();
  const body = Uint8Array.from([0, 10, 127, 128, 255]);
  const fetchMock = vi.fn(async (): Promise<Response> => {
    return new Response(body, {
      "headers": { "content-length": body.byteLength.toString() },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const progress = vi.fn();

  await runtime.host.downloads.toFile({
    "url"            : "https://example.test/client.jar",
    "destinationPath": "indexed_db/libraries/client.jar",
  }, progress);

  expect(fetchMock).toHaveBeenCalledWith("https://example.test/client.jar", {
    "credentials": "omit",
  });
  expect(storage.values.get("indexed_db/libraries/client.jar")).toEqual(body);
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
    "transferred": body.byteLength,
    "total"      : body.byteLength,
  }));
});

test("browser process APIs fail explicitly", async () => {
  const runtime = await createBrowserCapabilityBroker(noEventCapability, createMemoryStorage());

  await expect(runtime.host.processes.launchMinecraft({
    "executable": "java",
    "arguments" : [],
    "cwd"       : "indexed_db/instance",
    "instanceId": "example",
  }, () => {})).rejects.toBeInstanceOf(UnsupportedInBrowserPreviewError);
});

const browserIdentityTestName =
  "browser preparation uses identity-stable logical roots without claiming OS identity";

test(browserIdentityTestName, async () => {
  const runtime = await createBrowserCapabilityBroker(noEventCapability, createMemoryStorage());
  const [firstExternal, secondExternal, process] = await Promise.all([
    runtime.preparePermissionRequests([{
      "id"   : "storage/external/read",
      "scope": { "roots": ["/logical/root"] },
    }]),
    runtime.preparePermissionRequests([{
      "id"   : "storage/external/read",
      "scope": { "roots": ["/logical/root"] },
    }]),
    runtime.preparePermissionRequests([{
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ "path": "/logical/tool", "arguments": [] }] },
    }]),
  ]);

  expect(firstExternal).toEqual(secondExternal);
  expect(firstExternal[0]?.targetIdentities).toEqual([{
    "kind"            : "external_storage_root",
    "path"            : "/logical/root",
    "identityProvider": "browser-preview-logical-v1",
  }]);
  expect(process[0]?.targetIdentities).toEqual([{
    "kind"            : "process_executable",
    "path"            : "/logical/tool",
    "identityProvider": "browser-preview-unsupported-v1",
  }]);
  expect(JSON.stringify([firstExternal, process])).not.toContain("desktop-filesystem-v1");
});

test("browser plugin HTTP authorizes every redirect hop against an exact grant", async () => {
  const runtime = await createBrowserCapabilityBroker(noEventCapability, createMemoryStorage());
  const session = await runtime.openPluginSession(principal());
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (input === "https://a.example.test/redirect") {
      return new Response(null, {
        "status" : 307,
        "headers": { "location": "https://b.example.test/redirect-target" },
      });
    }

    return new Response("ok");
  });

  vi.stubGlobal("fetch", fetchMock);
  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": {
      "origins": ["https://a.example.test"],
      "methods": ["GET"],
    },
  });
  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": {
      "origins": ["https://b.example.test"],
      "methods": ["POST"],
    },
  });

  const network = session.capabilityFactories["network/http"]();

  await expect(network.fetch({
    "url"    : "https://a.example.test/redirect",
    "method" : "GET",
    "headers": [],
  })).rejects.toThrow("outside its grant");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://a.example.test/redirect",
    expect.objectContaining({ "redirect": "manual" }),
  );

  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": {
      "origins": ["https://b.example.test"],
      "methods": ["GET"],
    },
  });
  await expect(network.fetch({
    "url"    : "https://a.example.test/redirect",
    "method" : "GET",
    "headers": [],
  })).resolves.toMatchObject({ "status": 200 });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "https://b.example.test/redirect-target",
    expect.objectContaining({ "method": "GET", "redirect": "manual" }),
  );
});

test("browser plugin grants accumulate exact network and storage scopes", async () => {
  const storage = createMemoryStorage();
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const session = await runtime.openPluginSession(principal());
  const fetchMock = vi.fn(async (): Promise<Response> => new Response("ok"));

  vi.stubGlobal("fetch", fetchMock);
  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": { "origins": ["https://a.example.test"], "methods": ["GET"] },
  });
  await grant(runtime, session, {
    "id"   : "storage/external/write",
    "scope": { "roots": ["/allowed/a"] },
  });
  const network = session.capabilityFactories["network/http"]();
  const externalWrite = session.capabilityFactories["storage/external/write"]();

  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": { "origins": ["https://b.example.test"], "methods": ["POST"] },
  });
  await grant(runtime, session, {
    "id"   : "storage/external/write",
    "scope": { "roots": ["/allowed/b"] },
  });

  await network.fetch({
    "url": "https://a.example.test/data", "method": "GET", "headers": [],
  });
  await network.fetch({
    "url": "https://b.example.test/data", "method": "POST", "headers": [],
  });
  await expect(network.fetch({
    "url": "https://a.example.test/data", "method": "POST", "headers": [],
  })).rejects.toThrow("outside its grant");
  await expect(network.fetch({
    "url": "https://b.example.test/data", "method": "GET", "headers": [],
  })).rejects.toThrow("outside its grant");
  await expect(network.fetch({
    "url": "https://c.example.test/data", "method": "GET", "headers": [],
  })).rejects.toThrow("outside its grant");
  await externalWrite.writeText({ "root": "/allowed/a", "relativePath": "a.txt" }, "a");
  await externalWrite.writeText({ "root": "/allowed/b", "relativePath": "b.txt" }, "b");
  await expect(externalWrite.writeText(
    { "root": "/allowed/c", "relativePath": "c.txt" },
    "c",
  )).rejects.toThrow("outside its grant");

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(storage.values.get("/allowed/a/a.txt")).toBe("a");
  expect(storage.values.get("/allowed/b/b.txt")).toBe("b");
});

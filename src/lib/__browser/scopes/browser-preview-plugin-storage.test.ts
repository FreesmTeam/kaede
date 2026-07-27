import { expect, test } from "vitest";

import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";
import {
  createBrowserCapabilityBroker,
} from "@/lib/browser/scopes/create-browser-capability-broker.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

function noEventCapability(): undefined {
  return;
}

test("plugin external storage cannot cross into private broker records", async () => {
  const values = new Map<string, BrowserStorageValue>;
  const storage: BrowserStorage = Object.freeze({
    "keys": async () => [...values.keys()],
    "read": async (path: string) => {
      const value = values.get(path);

      return value === undefined
        ? Object.freeze({ "kind": "missing" })
        : Object.freeze({ "kind": "value", value });
    },
    "write": async (path: string, value: BrowserStorageValue) => {
      values.set(path, value);
    },
    "remove": async (path: string) => {
      values.delete(path);
    },
  });
  const principal = createPluginPrincipal({
    "repositoryOrigin": "https://plugins.example.test/owner/repository",
    "pluginId"        : "browser.preview.storage-boundary",
    "version"         : "1.0.0",
    "artifactSha256"  : "c".repeat(64),
  });
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);

  await runtime.decisionStore.save(Object.freeze({
    "kind"              : "dynamic",
    "principalKey"      : createPluginPrincipalKey(principal),
    "requestFingerprint": "permission-request-v1:logging/write",
  }), true);
  const persistedPath = [...values.keys()][0];
  const session = await runtime.openPluginSession(principal);

  const prepared = await runtime.preparePermissionRequests([{
    "id"   : "storage/external/read",
    "scope": { "roots": ["indexed_db"] },
  }]);
  const request = prepared[0];

  if (request === undefined) {
    throw new TypeError("Expected one prepared browser permission request");
  }

  await session.grant(request);
  const externalRead = session.capabilityFactories["storage/external/read"]();

  await expect(externalRead.readText({
    "root"        : "indexed_db",
    "relativePath": persistedPath?.slice("indexed_db/".length) ?? "",
  })).rejects.toThrow("private broker storage");
});

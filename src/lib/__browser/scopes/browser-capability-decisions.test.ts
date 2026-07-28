import { expect, test } from "vitest";

import {
  createMemoryStorage,
  decisionKey,
  noEventCapability,
  persistedDecisionPath,
  principal,
} from "@/lib/browser/scopes/create-browser-capability-broker.test-helpers.ts";
import {
  createBrowserCapabilityBroker,
} from "@/lib/browser/scopes/create-browser-capability-broker.ts";
import {
  getPermissionRequestFingerprint,
  getStaticPermissionSetFingerprint,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

test("browser permission decisions persist with exact artifact and scope binding", async () => {
  const storage = createMemoryStorage();
  const key = decisionKey();
  const firstRuntime = await createBrowserCapabilityBroker(noEventCapability, storage);

  await firstRuntime.decisionStore.save(key, true);

  const secondRuntime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const otherArtifact = principal();
  const otherArtifactKey = decisionKey({
    ...otherArtifact,
    "artifactSha256": "b".repeat(64),
  });
  const otherScopeKey = decisionKey(principal(), "permission-request-v1:events/subscribe");
  const persistedPath = persistedDecisionPath(storage);

  await expect(secondRuntime.decisionStore.load(key)).resolves.toBe(true);
  await expect(secondRuntime.decisionStore.load(otherArtifactKey)).resolves.toBeUndefined();
  await expect(secondRuntime.decisionStore.load(otherScopeKey)).resolves.toBeUndefined();
  expect(persistedPath).not.toContain("plugin-data");
  expect(typeof storage.values.get(persistedPath ?? "")).toBe("string");
  expect(Object.isFrozen(secondRuntime.decisionStore)).toBe(true);
});

test("browser permission decisions fail closed without replacing corrupt entries", async () => {
  const storage = createMemoryStorage();
  const key = decisionKey();
  const firstRuntime = await createBrowserCapabilityBroker(noEventCapability, storage);

  await firstRuntime.decisionStore.save(key, false);
  const persistedPath = persistedDecisionPath(storage);

  storage.values.set(persistedPath ?? "", "not-json");

  const secondRuntime = await createBrowserCapabilityBroker(noEventCapability, storage);

  await expect(secondRuntime.decisionStore.load(key)).rejects.toThrow(
    "Corrupt browser permission decision record",
  );
  await expect(secondRuntime.decisionStore.save(key, true)).rejects.toThrow(
    "Corrupt browser permission decision record",
  );
  expect(storage.values.get(persistedPath ?? "")).toBe("not-json");

  const unsupportedValue = Object.freeze({ "unexpected": true });

  storage.values.set(persistedPath ?? "", unsupportedValue);
  await expect(secondRuntime.decisionStore.load(key))
    .rejects.toThrow("Unsupported browser storage value");
  await expect(secondRuntime.decisionStore.save(key, true))
    .rejects.toThrow("Unsupported browser storage value");
  expect(storage.values.get(persistedPath ?? "")).toBe(unsupportedValue);
});

test("long prepared target identities persist through bounded decision fingerprints", async () => {
  const storage = createMemoryStorage();
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const prepared = await runtime.preparePermissionRequests([{
    "id"   : "storage/external/read",
    "scope": { "roots": [`/${"a".repeat(5000)}`] },
  }]);
  const request = prepared[0];

  if (request === undefined) {
    throw new TypeError("Expected one long prepared browser permission request");
  }

  const dynamicFingerprint = getPermissionRequestFingerprint(request);
  const staticFingerprint = getStaticPermissionSetFingerprint(prepared);
  const dynamicKey = decisionKey(principal(), dynamicFingerprint);
  const staticKey = Object.freeze({
    "kind"              : "static" as const,
    "principalKey"      : createPluginPrincipalKey(principal()),
    "requestFingerprint": staticFingerprint,
  });

  expect((new TextEncoder).encode(dynamicFingerprint).byteLength).toBeLessThanOrEqual(4096);
  expect((new TextEncoder).encode(staticFingerprint).byteLength).toBeLessThanOrEqual(4096);
  await runtime.decisionStore.save(dynamicKey, true);
  await runtime.decisionStore.save(staticKey, false);

  const reloaded = await createBrowserCapabilityBroker(noEventCapability, storage);

  await expect(reloaded.decisionStore.load(dynamicKey)).resolves.toBe(true);
  await expect(reloaded.decisionStore.load(staticKey)).resolves.toBe(false);
});

test("large principal and network scope keys survive browser save and reload", async () => {
  const storage = createMemoryStorage();
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const largePrincipal = createPluginPrincipal({
    "repositoryOrigin": `https://plugins.example.test/${"repository".repeat(650)}`,
    "pluginId"        : "browser.preview.large-scope",
    "version"         : "1.0.0",
    "artifactSha256"  : "c".repeat(64),
  });
  const prepared = await runtime.preparePermissionRequests([{
    "id"   : "network/http",
    "scope": {
      "origins": Array.from(
        { "length": 300 },
        (_, index) => `https://scope-${index.toString().padStart(3, "0")}.example.test`,
      ),
      "methods": ["GET", "POST"],
    },
  }]);
  const request = prepared[0];

  if (request === undefined) {
    throw new TypeError("Expected one large network permission request");
  }

  const principalKey = createPluginPrincipalKey(largePrincipal);
  const dynamicFingerprint = getPermissionRequestFingerprint(request);
  const staticFingerprint = getStaticPermissionSetFingerprint(prepared);
  const dynamicKey = Object.freeze({
    "kind"              : "dynamic" as const,
    principalKey,
    "requestFingerprint": dynamicFingerprint,
  });
  const staticKey = Object.freeze({
    "kind"              : "static" as const,
    principalKey,
    "requestFingerprint": staticFingerprint,
  });

  expect(largePrincipal.repositoryOrigin.length).toBeGreaterThan(5000);
  expect(JSON.stringify(request).length).toBeGreaterThan(5000);
  expect(principalKey).toMatch(/^plugin-principal-v2:sha256:[a-f0-9]{64}$/u);
  expect(dynamicFingerprint).toMatch(/^permission-request-v2:sha256:[a-f0-9]{64}$/u);
  expect(staticFingerprint).toMatch(/^static-permission-set-v2:sha256:[a-f0-9]{64}$/u);

  await runtime.decisionStore.save(dynamicKey, true);
  await runtime.decisionStore.save(staticKey, false);

  const reloaded = await createBrowserCapabilityBroker(noEventCapability, storage);

  await expect(reloaded.decisionStore.load(dynamicKey)).resolves.toBe(true);
  await expect(reloaded.decisionStore.load(staticKey)).resolves.toBe(false);
});

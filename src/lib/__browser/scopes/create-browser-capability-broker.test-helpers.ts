import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";
import type {
  CapabilityBrokerRuntime,
  PermissionDecisionStoreKey,
  PluginCapabilitySession,
} from "@/lib/capability-broker/types.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
  type PluginPrincipal,
} from "@/lib/extensions-manager/scopes/principal.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export type Deferred = Readonly<{
  "promise": Promise<void>;
  "resolve": () => void;
}>;

export function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });

  return Object.freeze({
    promise,
    "resolve": (): void => resolvePromise?.(),
  });
}

export function createMemoryStorage(): BrowserStorage & Readonly<{
  "values": Map<string, unknown>;
}> {
  const values = new Map<string, unknown>;

  return Object.freeze({
    values,
    "keys": async () => [...values.keys()],
    "read": async (path: string) => {
      if (!values.has(path)) {
        return Object.freeze({ "kind": "missing" as const });
      }

      const value = values.get(path);

      if (typeof value !== "string" && !(value instanceof Uint8Array)) {
        throw new TypeError(`Unsupported browser storage value: ${JSON.stringify(path)}`);
      }

      return Object.freeze({ "kind": "value" as const, value });
    },
    "write": async (path: string, value: BrowserStorageValue) => {
      values.set(path, typeof value === "string" ? value : Uint8Array.from(value));
    },
    "remove": async (path: string) => {
      values.delete(path);
    },
  });
}

export function noEventCapability(): undefined {
  return undefined;
}

export async function grant(
  runtime: CapabilityBrokerRuntime,
  session: PluginCapabilitySession,
  descriptor: PermissionRequest,
): Promise<void> {
  const prepared = await runtime.preparePermissionRequests([descriptor]);
  const request = prepared[0];

  if (request === undefined) {
    throw new TypeError("Expected one prepared browser permission request");
  }

  await session.grant(request);
}

export function principal(): PluginPrincipal {
  return createPluginPrincipal({
    "repositoryOrigin": "https://plugins.example.test/owner/repository",
    "pluginId"        : "browser.preview.test",
    "version"         : "1.0.0",
    "artifactSha256"  : "a".repeat(64),
  });
}

export function decisionKey(
  pluginPrincipal: PluginPrincipal = principal(),
  requestFingerprint = "permission-request-v1:logging/write",
): PermissionDecisionStoreKey {
  return Object.freeze({
    "kind"        : "dynamic",
    "principalKey": createPluginPrincipalKey(pluginPrincipal),
    requestFingerprint,
  });
}

export function persistedDecisionPath(
  storage: ReturnType<typeof createMemoryStorage>,
): string | undefined {
  return [...storage.values.keys()].find(path => {
    return path.startsWith("indexed_db/capability-broker/permission-decisions/v1/");
  });
}

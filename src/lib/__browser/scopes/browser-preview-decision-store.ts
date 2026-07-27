import { joinBrowserPath } from "@/lib/browser/scopes/browser-preview-paths.ts";
import {
  BROWSER_BROKER_PRIVATE_STORAGE_ROOT,
} from "@/lib/browser/scopes/browser-preview-private-storage.ts";
import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";
import type {
  BrokerDecisionStore,
  PermissionDecisionStoreKey,
} from "@/lib/capability-broker/types.ts";
import { copyAndSort } from "@/lib/collections/copy-array.ts";

const DECISION_RECORD_VERSION = 1;
const MAX_OPAQUE_KEY_BYTES = 4096;
const INVALID_OPAQUE_KEY_CHARACTER_PATTERN = /[\p{Cc}\p{Cs}]/u;
const DECISION_STORAGE_NAMESPACE = joinBrowserPath(
  BROWSER_BROKER_PRIVATE_STORAGE_ROOT,
  "permission-decisions",
  `v${DECISION_RECORD_VERSION}`,
);
const DECISION_RECORD_KEYS = Object.freeze([
  "decision",
  "kind",
  "principalKey",
  "requestFingerprint",
  "version",
]);

type BrowserDecisionRecord = Readonly<{
  "version"           : typeof DECISION_RECORD_VERSION;
  "kind"              : PermissionDecisionStoreKey["kind"];
  "principalKey"      : string;
  "requestFingerprint": string;
  "decision"          : boolean;
}>;

function isValidOpaqueKey(value: string): boolean {
  return value.length > 0 &&
    (new TextEncoder).encode(value).byteLength <= MAX_OPAQUE_KEY_BYTES &&
    !INVALID_OPAQUE_KEY_CHARACTER_PATTERN.test(value);
}

function validateDecisionKey(key: PermissionDecisionStoreKey): void {
  if (!isValidOpaqueKey(key.principalKey)) {
    throw new TypeError("Principal key is not a bounded opaque key");
  }

  if (!isValidOpaqueKey(key.requestFingerprint)) {
    throw new TypeError("Request fingerprint is not a bounded opaque key");
  }
}

function opaqueKeySegment(value: string): string {
  const byteLength = (new TextEncoder).encode(value).byteLength;

  return `${byteLength}-${encodeURIComponent(value)}`;
}

function decisionStorageKey(key: PermissionDecisionStoreKey): string {
  validateDecisionKey(key);

  return joinBrowserPath(
    DECISION_STORAGE_NAMESPACE,
    key.kind,
    opaqueKeySegment(key.principalKey),
    opaqueKeySegment(key.requestFingerprint),
  );
}

function corruptDecisionRecord(path: string): Error {
  return new Error(`Corrupt browser permission decision record: ${JSON.stringify(path)}`);
}

function parseDecisionRecord(
  value: BrowserStorageValue,
  expectedKey: PermissionDecisionStoreKey,
  path: string,
): BrowserDecisionRecord {
  if (typeof value !== "string") {
    throw corruptDecisionRecord(path);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw corruptDecisionRecord(path);
  }

  const recordKeys = typeof parsed === "object" && parsed !== null
    ? copyAndSort(Object.keys(parsed))
    : [];

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    recordKeys.some((recordKey, index) => {
      return recordKey !== DECISION_RECORD_KEYS[index];
    }) ||
    recordKeys.length !== DECISION_RECORD_KEYS.length
  ) {
    throw corruptDecisionRecord(path);
  }

  const version = Reflect.get(parsed, "version");
  const kind = Reflect.get(parsed, "kind");
  const principalKey = Reflect.get(parsed, "principalKey");
  const requestFingerprint = Reflect.get(parsed, "requestFingerprint");
  const decision = Reflect.get(parsed, "decision");

  if (
    version !== DECISION_RECORD_VERSION ||
    (kind !== "dynamic" && kind !== "static") ||
    typeof principalKey !== "string" ||
    typeof requestFingerprint !== "string" ||
    typeof decision !== "boolean" ||
    !isValidOpaqueKey(principalKey) ||
    !isValidOpaqueKey(requestFingerprint) ||
    kind !== expectedKey.kind ||
    principalKey !== expectedKey.principalKey ||
    requestFingerprint !== expectedKey.requestFingerprint
  ) {
    throw corruptDecisionRecord(path);
  }

  return Object.freeze({
    version,
    kind,
    principalKey,
    requestFingerprint,
    decision,
  });
}

function serializeDecisionRecord(
  key: PermissionDecisionStoreKey,
  decision: boolean,
): string {
  const record: BrowserDecisionRecord = Object.freeze({
    "version"           : DECISION_RECORD_VERSION,
    "kind"              : key.kind,
    "principalKey"      : key.principalKey,
    "requestFingerprint": key.requestFingerprint,
    decision,
  });

  return JSON.stringify(record);
}

export function createBrowserDecisionStore(storage: BrowserStorage): BrokerDecisionStore {
  return Object.freeze({
    "load": async (key: PermissionDecisionStoreKey): Promise<boolean | undefined> => {
      const path = decisionStorageKey(key);
      const result = await storage.read(path);

      if (result.kind === "missing") {
        return undefined;
      }

      return parseDecisionRecord(result.value, key, path).decision;
    },
    "save": async (key: PermissionDecisionStoreKey, decision: boolean): Promise<void> => {
      const path = decisionStorageKey(key);
      const result = await storage.read(path);

      if (result.kind === "value") {
        parseDecisionRecord(result.value, key, path);
      }

      await storage.write(path, serializeDecisionRecord(key, decision));
    },
  });
}

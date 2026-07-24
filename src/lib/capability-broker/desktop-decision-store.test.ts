import { expect, test } from "vitest";

import type {
  BrokerRequest,
  BrokerResponse,
} from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import { createDecisionStore } from "@/lib/capability-broker/desktop-decision-store.ts";
import {
  prepareIdentityFreePermissionRequests,
} from "@/lib/capability-broker/permission-preparation.ts";
import {
  getPermissionRequestFingerprint,
  getStaticPermissionSetFingerprint,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

test("large principal and network scope keys survive desktop DTO save and reload", async () => {
  const calls: Array<BrokerRequest> = [];
  const decisions = new Map<string, boolean>;
  const decisionKey = (
    request: Extract<BrokerRequest, { "kind": "decision_load" | "decision_save" }>,
  ): string => JSON.stringify({
    "kind"              : request.decisionKind,
    "principalKey"      : request.principalKey,
    "requestFingerprint": request.requestFingerprint,
  });
  const call: BrokerCall = async request => {
    calls.push(request);

    let response: BrokerResponse;

    if (request.kind === "decision_save") {
      decisions.set(decisionKey(request), request.decision);
      response = { "kind": "decision_saved" };
    } else if (request.kind === "decision_load") {
      response = { "kind": "decision", "decision": decisions.get(decisionKey(request)) ?? null };
    } else {
      throw new TypeError(`Unexpected broker request: ${request.kind}`);
    }

    return response;
  };
  const largePrincipal = createPluginPrincipal({
    "repositoryOrigin": `https://plugins.example.test/${"repository".repeat(650)}`,
    "pluginId"        : "desktop.large-scope",
    "version"         : "1.0.0",
    "artifactSha256"  : "d".repeat(64),
  });
  const prepared = prepareIdentityFreePermissionRequests([{
    "id"   : "network/http",
    "scope": {
      "origins": Array.from(
        { "length": 300 },
        (_, index) => `https://scope-${index.toString().padStart(3, "0")}.example.test`,
      ),
      "methods": ["GET", "POST"],
    },
  }], false);
  const request = prepared[0];

  if (request === undefined) {
    throw new TypeError("Expected one large network permission request");
  }

  const principalKey = createPluginPrincipalKey(largePrincipal);
  const dynamicKey = Object.freeze({
    "kind"              : "dynamic" as const,
    principalKey,
    "requestFingerprint": getPermissionRequestFingerprint(request),
  });
  const staticKey = Object.freeze({
    "kind"              : "static" as const,
    principalKey,
    "requestFingerprint": getStaticPermissionSetFingerprint(prepared),
  });
  const firstStore = createDecisionStore(call);

  expect(largePrincipal.repositoryOrigin.length).toBeGreaterThan(5000);
  expect(JSON.stringify(request).length).toBeGreaterThan(5000);
  await firstStore.save(dynamicKey, true);
  await firstStore.save(staticKey, false);

  const reloadedStore = createDecisionStore(call);

  await expect(reloadedStore.load(dynamicKey)).resolves.toBe(true);
  await expect(reloadedStore.load(staticKey)).resolves.toBe(false);
  expect(calls).toEqual([
    {
      "kind"              : "decision_save",
      "decisionKind"      : "dynamic",
      "principalKey"      : dynamicKey.principalKey,
      "requestFingerprint": dynamicKey.requestFingerprint,
      "decision"          : true,
    },
    {
      "kind"              : "decision_save",
      "decisionKind"      : "static",
      "principalKey"      : staticKey.principalKey,
      "requestFingerprint": staticKey.requestFingerprint,
      "decision"          : false,
    },
    {
      "kind"              : "decision_load",
      "decisionKind"      : "dynamic",
      "principalKey"      : dynamicKey.principalKey,
      "requestFingerprint": dynamicKey.requestFingerprint,
    },
    {
      "kind"              : "decision_load",
      "decisionKind"      : "static",
      "principalKey"      : staticKey.principalKey,
      "requestFingerprint": staticKey.requestFingerprint,
    },
  ]);
});

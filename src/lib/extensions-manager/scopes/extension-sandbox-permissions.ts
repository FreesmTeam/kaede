import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker";
import {
  snapshotPreparedPermissionRequest,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  ExtensionLifecycleDependencies,
  LifecyclePluginSession,
} from "@/lib/extensions-manager/scopes/extension-lifecycle-contract.ts";
import {
  normalizePermissionRequests,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  PermissionGrant,
  PermissionId,
  PermissionRequest,
} from "@/types/extensions/permission.type.ts";

type SandboxPermissionDependencies = Pick<
  ExtensionLifecycleDependencies,
  "preparePermissionRequests" | "requestDynamicPermissions"
>;

type DynamicPermissionGrantOptions = Readonly<{
  "assertActive": () => void;
  "dependencies": SandboxPermissionDependencies;
  "principal"   : PluginPrincipal;
  "requests"    : ReadonlyArray<PermissionRequest>;
  "session"     : LifecyclePluginSession;
}>;

function permissionId(request: PermissionRequest): PermissionId {
  return typeof request === "string" ? request : request.id;
}

function normalizeDynamicRequests(
  requests: ReadonlyArray<PermissionRequest>,
): ReadonlyArray<PermissionRequest> {
  return requests.map(request => {
    const normalized = normalizePermissionRequests([request])[0];

    if (normalized === undefined) {
      throw new TypeError("A permission request cannot normalize to an empty set");
    }

    return normalized;
  });
}

export async function prepareSandboxPermissionRequests(
  dependencies: SandboxPermissionDependencies,
  requests: ReadonlyArray<PermissionRequest>,
): Promise<ReadonlyArray<PreparedPermissionRequest>> {
  const prepared = await dependencies.preparePermissionRequests(requests);

  if (prepared.length !== requests.length) {
    throw new RangeError("Prepared permissions must positionally match every request");
  }

  return Object.freeze(prepared.map(request => {
    return snapshotPreparedPermissionRequest(request);
  }));
}

export async function requestDynamicPermissionGrant({
  assertActive,
  dependencies,
  principal,
  requests,
  session,
}: DynamicPermissionGrantOptions): Promise<PermissionGrant> {
  assertActive();

  const normalizedRequests = normalizeDynamicRequests(requests);
  const preparedRequests = await prepareSandboxPermissionRequests(
    dependencies,
    normalizedRequests,
  );

  assertActive();

  const decisions = await dependencies.requestDynamicPermissions(
    principal,
    preparedRequests,
  );

  assertActive();

  if (decisions.length !== preparedRequests.length) {
    throw new RangeError("Dynamic permission decisions must match every request");
  }

  const granted: Array<PermissionId> = [];
  const denied: Array<PermissionId> = [];
  const capabilities: Record<string, unknown> = Object.create(null);

  for (const [index, prepared] of preparedRequests.entries()) {
    const id = permissionId(prepared.descriptor);

    if (decisions[index] !== true) {
      denied.push(id);
      continue;
    }

    await session.grant(prepared);
    assertActive();
    granted.push(id);

    if (id === "ui/basic" || id === "ui/forms/non-credential") {
      continue;
    }

    const factory = session.capabilityFactories[id];

    if (factory === undefined) {
      throw new TypeError(`Missing capability factory for granted permission: ${id}`);
    }

    capabilities[id] = factory();
  }

  return Object.freeze({
    "granted"     : Object.freeze(granted),
    "denied"      : Object.freeze(denied),
    "capabilities": Object.freeze(capabilities),
  });
}

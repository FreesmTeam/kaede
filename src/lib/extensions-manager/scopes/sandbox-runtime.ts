import type { SafeDocument } from "ark-of-atrahasis";

import {
  assertEnvironmentLockdownCompleted,
  hardenWithCapturedAuthority,
} from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import {
  normalizePermissionRequests,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import {
  cloneCapability,
  getPermissionId,
  snapshotPermissionGrant,
} from "@/lib/extensions-manager/scopes/sandbox-grant-snapshot.ts";
import {
  cleanupRuntimeResources,
  SandboxResourceError,
} from "@/lib/extensions-manager/scopes/sandbox-runtime-resources.ts";
import type {
  ArkRuntimeModule,
  NonDOMPermissionId,
  PermissionRequestFor,
  SandboxRuntimeHandle,
  SandboxRuntimeOptions,
  StaticCapabilityFactories,
} from "@/lib/extensions-manager/scopes/sandbox-runtime-types.ts";
import {
  createSandboxHostBoundary,
  createStaticDocumentOptions,
  normalizeSandboxMaxBounds,
} from "@/lib/extensions-manager/scopes/sandbox-ui-boundary.ts";
import type {
  PermissionGrant,
  PermissionId,
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

export type {
  SandboxMaxBounds,
  SandboxRuntimeHandle,
  SandboxRuntimeOptions,
  StaticCapabilityFactories,
} from "@/lib/extensions-manager/scopes/sandbox-runtime-types.ts";

function createNonDOMCapability<Id extends NonDOMPermissionId>(
  id: Id,
  permission: PermissionRequestFor<Id>,
  factories: StaticCapabilityFactories,
): PluginCapabilities[Id] {
  const factory = factories[id];

  if (factory === undefined) {
    throw new TypeError(`${id} requires an injected broker capability factory`);
  }

  return factory(permission);
}

function buildStaticCapabilities(
  permissions: ReadonlyArray<PermissionRequest>,
  safeDocument: SafeDocument,
  factories: StaticCapabilityFactories,
): Readonly<{
  "granted"     : ReadonlyArray<PermissionId>;
  "capabilities": Record<string, unknown>;
}> {
  const capabilities: Record<string, unknown> = Object.create(null);
  const granted: Array<PermissionId> = [];

  for (const permission of permissions) {
    const id = getPermissionId(permission);

    granted.push(id);

    if (id === "ui/basic") {
      capabilities[id] = safeDocument;
      continue;
    }

    if (id === "ui/forms/non-credential") {
      continue;
    }

    capabilities[id] = cloneCapability(createNonDOMCapability(
      id,
      permission as PermissionRequestFor<typeof id>,
      factories,
    ));
  }

  return { granted, capabilities };
}

export async function createSandboxRuntime({
  trustedContainer,
  maxBounds,
  staticPermissions,
  "requestPermissions": requestHostPermissions,
  nonDOMCapabilityFactories = {},
  disposeEvents,
  dependencies = {},
}: SandboxRuntimeOptions): Promise<SandboxRuntimeHandle> {
  const normalizedMaxBounds = normalizeSandboxMaxBounds(maxBounds);
  const assertLockdown = dependencies.assertLockdown ?? assertEnvironmentLockdownCompleted;

  assertLockdown();

  const loadArk = dependencies.loadArk ?? (async (): Promise<ArkRuntimeModule> => {
    return await import("ark-of-atrahasis");
  });
  const ark = await loadArk();
  const hardener = dependencies.harden ?? hardenWithCapturedAuthority;
  const hostFactory = dependencies.createHostBoundary ?? createSandboxHostBoundary;
  const normalizedStaticPermissions = normalizePermissionRequests(staticPermissions);
  const hostBoundary = hostFactory(trustedContainer, normalizedMaxBounds);
  let safeDocument: SafeDocument | undefined;
  let isDisposed = false;

  try {
    const hasStaticFormsPermission = normalizedStaticPermissions.includes(
      "ui/forms/non-credential",
    );
    const documentOptions = createStaticDocumentOptions(
      normalizedStaticPermissions,
      ark.SAFE_STYLE_PROPERTIES,
      ark.URL_SINKS,
      hardener,
    );

    safeDocument = ark.createSafeDocument(hostBoundary.root, documentOptions);

    const staticCapabilities = buildStaticCapabilities(
      normalizedStaticPermissions,
      safeDocument,
      nonDOMCapabilityFactories,
    );
    const capabilities = hardener(staticCapabilities.capabilities) as Readonly<
      Partial<PluginCapabilities>
    >;
    const staticGrant = hardener({
      "granted": Object.freeze(staticCapabilities.granted),
      "denied" : Object.freeze([]) as ReadonlyArray<PermissionId>,
      capabilities,
    });
    const requestPermissions = hardener(async (
      requestedPermissions: ReadonlyArray<PermissionRequest>,
    ): Promise<PermissionGrant> => {
      if (isDisposed) {
        throw new TypeError("Sandbox runtime has been disposed");
      }

      const normalizedRequests = normalizePermissionRequests(requestedPermissions);
      const denyDynamicForms = !hasStaticFormsPermission && normalizedRequests.includes(
        "ui/forms/non-credential",
      );
      const forwardedRequests = denyDynamicForms
        ? normalizedRequests.filter(permission => permission !== "ui/forms/non-credential")
        : normalizedRequests;
      const grant = forwardedRequests.length === 0
        ? {
          "granted"     : [],
          "denied"      : [],
          "capabilities": {},
        } satisfies PermissionGrant
        : await requestHostPermissions(forwardedRequests);

      if (isDisposed) {
        throw new TypeError("Sandbox runtime was disposed during the permission request");
      }

      const combinedGrant: PermissionGrant = denyDynamicForms
        ? {
          "granted"     : grant.granted,
          "denied"      : [...grant.denied, "ui/forms/non-credential"],
          "capabilities": grant.capabilities,
        }
        : grant;
      const requestedPermissionIds = new Set(normalizedRequests.map(permission => {
        return getPermissionId(permission);
      }));

      return snapshotPermissionGrant(
        combinedGrant,
        hardener,
        requestedPermissionIds,
        { "ui/basic": safeDocument },
      );
    });
    const dispose = hardener((): void => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      cleanupRuntimeResources(safeDocument, disposeEvents, hostBoundary);
    });

    return hardener({
      capabilities,
      staticGrant,
      requestPermissions,
      dispose,
    });
  } catch (error: unknown) {
    try {
      cleanupRuntimeResources(safeDocument, disposeEvents, hostBoundary);
    } catch (cleanupError: unknown) {
      throw new SandboxResourceError(
        "Sandbox runtime initialization and cleanup failed",
        [error, cleanupError],
      );
    }

    throw error;
  }
}

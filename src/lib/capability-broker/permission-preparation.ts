import type {
  BrowserPreviewTargetIdentity,
  PermissionTargetIdentity,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import {
  normalizePermissionRequests,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

type ExpectedTarget = Readonly<{
  "kind": PermissionTargetIdentity["kind"];
  "path": string;
}>;

const DECIMAL_IDENTITY = /^(?:0|[1-9]\d*)$/u;
const LOWERCASE_SHA256 = /^[\da-f]{64}$/u;

function snapshotDescriptor(descriptor: PermissionRequest): PermissionRequest {
  if (typeof descriptor === "string") {
    return descriptor;
  }

  switch (descriptor.id) {
    case "network/http": {
      return Object.freeze({
        "id"   : descriptor.id,
        "scope": Object.freeze({
          "origins": Object.freeze([...descriptor.scope.origins]),
          "methods": Object.freeze([...descriptor.scope.methods]),
        }),
      });
    }
    case "storage/internal/read":
    case "storage/internal/write": {
      return Object.freeze({
        "id"   : descriptor.id,
        "scope": Object.freeze({ "directory": descriptor.scope.directory }),
      });
    }
    case "storage/external/read":
    case "storage/external/write": {
      return Object.freeze({
        "id"   : descriptor.id,
        "scope": Object.freeze({
          "roots": Object.freeze([...descriptor.scope.roots]),
        }),
      });
    }
    case "system/process/spawn": {
      return Object.freeze({
        "id"   : descriptor.id,
        "scope": Object.freeze({
          "executables": Object.freeze(descriptor.scope.executables.map(executable => {
            return Object.freeze({
              "path"     : executable.path,
              "arguments": Object.freeze([...executable.arguments]),
            });
          })),
        }),
      });
    }
  }
}

function expectedTargets(descriptor: PermissionRequest): ReadonlyArray<ExpectedTarget> {
  if (typeof descriptor === "string") {
    return Object.freeze([]);
  }

  switch (descriptor.id) {
    case "storage/external/read":
    case "storage/external/write": {
      return Object.freeze(descriptor.scope.roots.map(path => Object.freeze({
        "kind": "external_storage_root" as const,
        path,
      })));
    }
    case "system/process/spawn": {
      return Object.freeze(descriptor.scope.executables.map(executable => Object.freeze({
        "kind": "process_executable" as const,
        "path": executable.path,
      })));
    }
    default: {
      return Object.freeze([]);
    }
  }
}

function snapshotTargetIdentity(
  identity: PermissionTargetIdentity,
  expected: ExpectedTarget,
): PermissionTargetIdentity {
  if (
    identity.kind !== expected.kind ||
    identity.path !== expected.path
  ) {
    throw new TypeError("Prepared permission target identity does not match its descriptor");
  }

  switch (identity.identityProvider) {
    case "desktop-filesystem-v1": {
      if (
        identity.kind !== "external_storage_root" ||
        !DECIMAL_IDENTITY.test(identity.device) ||
        !DECIMAL_IDENTITY.test(identity.inode)
      ) {
        throw new TypeError("Desktop permission target identity is invalid");
      }

      return Object.freeze({
        "kind"            : identity.kind,
        "path"            : identity.path,
        "identityProvider": identity.identityProvider,
        "device"          : identity.device,
        "inode"           : identity.inode,
      });
    }
    case "desktop-executable-sha256-v1": {
      if (
        identity.kind !== "process_executable" ||
        !DECIMAL_IDENTITY.test(identity.device) ||
        !DECIMAL_IDENTITY.test(identity.inode) ||
        !LOWERCASE_SHA256.test(identity.contentSha256)
      ) {
        throw new TypeError("Desktop executable target identity is invalid");
      }

      return Object.freeze({
        "kind"            : identity.kind,
        "path"            : identity.path,
        "identityProvider": identity.identityProvider,
        "device"          : identity.device,
        "inode"           : identity.inode,
        "contentSha256"   : identity.contentSha256,
      });
    }
    case "browser-preview-logical-v1":
    case "browser-preview-unsupported-v1": {
      if (
        (identity.identityProvider === "browser-preview-logical-v1" &&
          identity.kind !== "external_storage_root") ||
          (identity.identityProvider === "browser-preview-unsupported-v1" &&
            identity.kind !== "process_executable")
      ) {
        throw new TypeError("Browser permission target identity provider is invalid");
      }

      return Object.freeze({
        "kind"            : identity.kind,
        "path"            : identity.path,
        "identityProvider": identity.identityProvider,
      });
    }
  }
}

export function isPreparedPermissionRequest(
  request: PermissionRequest | PreparedPermissionRequest,
): request is PreparedPermissionRequest {
  return typeof request === "object" &&
    request !== null &&
    Object.prototype.hasOwnProperty.call(request, "descriptor") &&
    Object.prototype.hasOwnProperty.call(request, "targetIdentities");
}

export function snapshotPreparedPermissionRequest(
  prepared: PreparedPermissionRequest,
): PreparedPermissionRequest {
  const descriptor = snapshotDescriptor(prepared.descriptor);
  const expected = expectedTargets(descriptor);

  if (prepared.targetIdentities.length !== expected.length) {
    throw new TypeError(
      "Prepared permission request must bind every target to an exact identity",
    );
  }

  const targetIdentities = prepared.targetIdentities.map((identity, index) => {
    const expectedIdentity = expected[index];

    if (expectedIdentity === undefined) {
      throw new TypeError("Unexpected prepared permission target identity");
    }

    return snapshotTargetIdentity(identity, expectedIdentity);
  });

  return Object.freeze({
    descriptor,
    "targetIdentities": Object.freeze(targetIdentities),
  });
}

export function prepareIdentityFreePermissionRequests(
  requests: ReadonlyArray<PermissionRequest>,
  normalizeAsSet: boolean,
): ReadonlyArray<PreparedPermissionRequest> {
  const normalized = normalizeAsSet
    ? normalizePermissionRequests(requests)
    : requests.map(request => {
      const normalizedRequest = normalizePermissionRequests([request])[0];

      if (normalizedRequest === undefined) {
        throw new TypeError("A permission request cannot normalize to an empty set");
      }

      return normalizedRequest;
    });

  return Object.freeze(normalized.map(descriptor => {
    return snapshotPreparedPermissionRequest({ descriptor, "targetIdentities": [] });
  }));
}

function browserIdentity(
  target: ExpectedTarget,
): BrowserPreviewTargetIdentity {
  return Object.freeze({
    ...target,
    "identityProvider": target.kind === "external_storage_root"
      ? "browser-preview-logical-v1"
      : "browser-preview-unsupported-v1",
  });
}

export function prepareBrowserPermissionRequests(
  requests: ReadonlyArray<PermissionRequest>,
): ReadonlyArray<PreparedPermissionRequest> {
  return Object.freeze(requests.map(descriptor => {
    const identities = expectedTargets(descriptor).map(target => {
      return browserIdentity(target);
    });

    return snapshotPreparedPermissionRequest({
      descriptor,
      "targetIdentities": identities,
    });
  }));
}

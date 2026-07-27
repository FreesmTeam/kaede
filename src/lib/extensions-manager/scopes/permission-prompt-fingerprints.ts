import {
  isPreparedPermissionRequest,
  prepareIdentityFreePermissionRequests,
  snapshotPreparedPermissionRequest,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  PermissionDecisionStoreKey,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import { copyAndSort } from "@/lib/collections/copy-array.ts";
import { hashStringSha256Locally } from "@/lib/cryptography/local-hashes.ts";
import type {
  PermissionId,
  PermissionRequest,
} from "@/types/extensions/permission.type.ts";

function canonicalPermissionFingerprint(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalPermissionFingerprint(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    return `{${copyAndSort(Object.keys(value))
      .map(key => {
        return `${JSON.stringify(key)}:${canonicalPermissionFingerprint(Reflect.get(value, key))}`;
      })
      .join(",")}}`;
  }

  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("Permission requests may only contain JSON values");
  }

  return serialized;
}

export function getPermissionDecisionMemoryKey(key: PermissionDecisionStoreKey): string {
  return `permission-decision-memory-v1:sha256:${hashStringSha256Locally(
    canonicalPermissionFingerprint(key),
  )}`;
}

export function getPermissionRequestId(
  request: PermissionRequest | PreparedPermissionRequest,
): PermissionId {
  const descriptor = isPreparedPermissionRequest(request) ? request.descriptor : request;

  return typeof descriptor === "string" ? descriptor : descriptor.id;
}

export function getPermissionRequestFingerprint(
  request: PermissionRequest | PreparedPermissionRequest,
): string {
  const prepared = isPreparedPermissionRequest(request)
    ? snapshotPreparedPermissionRequest(request)
    : prepareIdentityFreePermissionRequests([request], false)[0];

  if (prepared === undefined) {
    throw new TypeError("A permission request cannot normalize to an empty set");
  }

  const canonicalPreparedRequest = canonicalPermissionFingerprint(prepared);

  return `permission-request-v2:sha256:${hashStringSha256Locally(canonicalPreparedRequest)}`;
}

function allPrepared(
  requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
): requests is ReadonlyArray<PreparedPermissionRequest> {
  return requests.every(request => isPreparedPermissionRequest(request));
}

function allUnprepared(
  requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
): requests is ReadonlyArray<PermissionRequest> {
  return requests.every(request => !isPreparedPermissionRequest(request));
}

export function getStaticPermissionSetFingerprint(
  requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
): string {
  if (!allPrepared(requests) && !allUnprepared(requests)) {
    throw new TypeError("Permission request sets cannot mix prepared and unprepared entries");
  }

  const preparedRequests = allPrepared(requests)
    ? requests.map(request => snapshotPreparedPermissionRequest(request))
    : prepareIdentityFreePermissionRequests(requests, true);
  const normalizedRequests = copyAndSort(
    preparedRequests.map(request => getPermissionRequestFingerprint(request)),
  );

  return `static-permission-set-v2:sha256:${hashStringSha256Locally(
    canonicalPermissionFingerprint(normalizedRequests),
  )}`;
}

export function getDynamicPermissionBatchFingerprint(
  requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
): string {
  const requestFingerprints = requests.map(request => {
    return getPermissionRequestFingerprint(request);
  });

  return `dynamic-permission-batch-v2:sha256:${hashStringSha256Locally(
    canonicalPermissionFingerprint(requestFingerprints),
  )}`;
}

export function getDynamicBatchDecisions(
  rememberedDecisions: ReadonlyArray<boolean | undefined>,
  decision: boolean,
): ReadonlyArray<boolean> {
  return rememberedDecisions.map(remembered => remembered ?? decision);
}

export function reconcileDynamicDraftDecisions(
  requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
  decisions: ReadonlyArray<boolean | undefined>,
): ReadonlyArray<boolean | undefined> {
  if (requests.length !== decisions.length) {
    throw new RangeError("Dynamic draft decisions must positionally match permission requests");
  }

  const decisionsByFingerprint = (new Map<string, boolean>);

  return requests.map((request, index) => {
    const decision = decisions[index];

    if (decision === undefined) {
      return decision;
    }

    const fingerprint = getPermissionRequestFingerprint(request);
    const existing = decisionsByFingerprint.get(fingerprint);

    if (existing !== undefined) {
      return existing;
    }

    decisionsByFingerprint.set(fingerprint, decision);

    return decision;
  });
}

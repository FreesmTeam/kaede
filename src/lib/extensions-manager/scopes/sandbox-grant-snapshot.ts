import type { Hardener } from "ark-of-atrahasis";

import { PERMISSION_IDS } from "@/constants/permissions.ts";
import type {
  PermissionGrant,
  PermissionId,
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

const PERMISSION_ID_SET: ReadonlySet<string> = new Set(PERMISSION_IDS);

export function getPermissionId(permission: PermissionRequest): PermissionId {
  return typeof permission === "string" ? permission : permission.id;
}

export function cloneCapability<Value>(
  value: Value,
  copies: WeakMap<object, unknown> = new WeakMap,
): Value {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "symbol") {
    throw new TypeError("Capability values cannot contain symbols");
  }

  if (typeof value === "function") {
    const existing = copies.get(value);

    if (existing !== undefined) {
      return existing as Value;
    }

    /* Keep the original callable authority reachable only through the closure. */
    const callableShell = (): never => {
      throw new TypeError(`Unreachable callable shell for ${typeof value}`);
    };
    const wrapped = new Proxy(callableShell, {
      "apply": (_target, thisArgument, argumentsList): unknown => {
        return Reflect.apply(value, thisArgument, argumentsList);
      },
    });

    copies.set(value, wrapped);

    return wrapped as Value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`Invalid capability value: ${typeof value}`);
  }

  const existing = copies.get(value);

  if (existing !== undefined) {
    return existing as Value;
  }

  if (Array.isArray(value)) {
    const clonedArray: Array<unknown> = [];

    copies.set(value, clonedArray);

    for (const item of value) {
      clonedArray.push(cloneCapability(item, copies));
    }

    return clonedArray as Value;
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== null && prototype !== Object.prototype) {
    throw new TypeError(
      "Capability values must be plain records, arrays, functions, or primitives",
    );
  }

  const clonedRecord: Record<string, unknown> = Object.create(null);

  copies.set(value, clonedRecord);

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new TypeError("Capability records cannot have symbol keys");
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`Capability records cannot have accessors: ${JSON.stringify(key)}`);
    }

    Object.defineProperty(clonedRecord, key, {
      "configurable": true,
      "enumerable"  : descriptor.enumerable,
      "value"       : cloneCapability(descriptor.value, copies),
      "writable"    : true,
    });
  }

  return clonedRecord as Value;
}

function assertPermissionId(value: string): asserts value is PermissionId {
  if (!PERMISSION_ID_SET.has(value)) {
    throw new TypeError(`Invalid permission grant ID: ${JSON.stringify(value)}`);
  }
}

function snapshotPermissionIds(
  values: ReadonlyArray<PermissionId>,
  label: string,
): ReadonlyArray<PermissionId> {
  if (!Array.isArray(values)) {
    throw new TypeError(`Permission grant ${label} must be an array`);
  }

  const snapshot: Array<PermissionId> = [];
  const seen = new Set<PermissionId>;

  for (const value of values) {
    assertPermissionId(value);

    if (seen.has(value)) {
      throw new TypeError(`Duplicate permission grant ${label} ID: ${JSON.stringify(value)}`);
    }

    seen.add(value);
    snapshot.push(value);
  }

  return Object.freeze(snapshot);
}

export function snapshotPermissionGrant(
  grant: PermissionGrant,
  hardener: Hardener,
  requestedPermissionIds: ReadonlySet<PermissionId>,
  capabilityOverrides: Readonly<Record<string, unknown>>,
): PermissionGrant {
  const granted = snapshotPermissionIds(grant.granted, "granted");
  const denied = snapshotPermissionIds(grant.denied, "denied");
  const grantedSet = new Set(granted);
  const capabilities: Record<string, unknown> = Object.create(null);

  for (const permission of [...granted, ...denied]) {
    if (!requestedPermissionIds.has(permission)) {
      throw new TypeError(`Permission response was not requested: ${permission}`);
    }
  }

  for (const permission of denied) {
    if (grantedSet.has(permission)) {
      throw new TypeError(`Permission cannot be both granted and denied: ${permission}`);
    }
  }

  if (
    grant.capabilities === null ||
    typeof grant.capabilities !== "object" ||
    Array.isArray(grant.capabilities)
  ) {
    throw new TypeError("Permission grant capabilities must be a record");
  }

  for (const key of Reflect.ownKeys(grant.capabilities)) {
    if (typeof key !== "string") {
      throw new TypeError("Permission grant capabilities cannot have symbol keys");
    }

    assertPermissionId(key);

    if (key === "ui/forms/non-credential") {
      throw new TypeError("ui/forms/non-credential is a policy modifier, not a capability");
    }

    if (!grantedSet.has(key)) {
      throw new TypeError(`Capability was not granted: ${JSON.stringify(key)}`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(grant.capabilities, key);

    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(
        `Permission grant capability cannot be an accessor: ${JSON.stringify(key)}`,
      );
    }

    const override = Object.getOwnPropertyDescriptor(capabilityOverrides, key);

    capabilities[key] = override !== undefined && "value" in override
      ? override.value
      : cloneCapability(descriptor.value);
  }

  for (const key of Reflect.ownKeys(capabilityOverrides)) {
    if (typeof key !== "string") {
      throw new TypeError("Capability overrides cannot have symbol keys");
    }

    assertPermissionId(key);

    if (!grantedSet.has(key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(capabilityOverrides, key);

    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`Capability override cannot be an accessor: ${JSON.stringify(key)}`);
    }

    capabilities[key] = descriptor.value;
  }

  return hardener({
    granted,
    denied,
    "capabilities": hardener(capabilities) as Readonly<Partial<PluginCapabilities>>,
  });
}

import {
  createCompartmentWithCapturedAuthority,
} from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import type {
  PermissionGrant,
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

export type SandboxCompartment = Readonly<{
  "evaluate": (code: string) => unknown;
}>;

export type SandboxCompartmentFactory = (
  globals: Readonly<{
    "scopedThis"        : Readonly<Partial<PluginCapabilities>>;
    "requestPermissions": (
      permissions: ReadonlyArray<PermissionRequest>,
    ) => Promise<PermissionGrant>;
  }>,
) => SandboxCompartment;

function createCompartment(
  globals: Parameters<SandboxCompartmentFactory>[0],
): SandboxCompartment {
  return createCompartmentWithCapturedAuthority(globals);
}

function assertDeeplyHardened(
  value: unknown,
  label: string,
  seen: WeakSet<object> = new WeakSet,
): void {
  if (
    typeof value !== "function" &&
    (value === null || typeof value !== "object")
  ) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (!Object.isFrozen(value)) {
    throw new TypeError(`${label} must be deeply hardened before evaluation`);
  }

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${label} must contain only hardened own-data properties`);
    }

    assertDeeplyHardened(descriptor.value, label, seen);
  }
}

export function runInSandbox<Result = unknown>({
  code,
  scopedThis,
  requestPermissions,
  "createCompartment": compartmentFactory = createCompartment,
}: {
  "code"              : string;
  "scopedThis"        : Readonly<Partial<PluginCapabilities>>;
  "requestPermissions": (
    permissions: ReadonlyArray<PermissionRequest>,
  ) => Promise<PermissionGrant>;
  "createCompartment"?: SandboxCompartmentFactory;
}): Result {
  assertDeeplyHardened(scopedThis, "Sandbox static capabilities");
  assertDeeplyHardened(requestPermissions, "Sandbox permission request callback");

  const compartment = compartmentFactory(Object.freeze({
    scopedThis,
    requestPermissions,
  }));

  return compartment.evaluate(code) as Result;
}

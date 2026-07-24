import "ses";

export type LockdownImplementation = (
  options: Readonly<{ "evalTaming": "safe-eval" }>,
) => void;

export type HardenImplementation = <Value>(value: Value) => Value;

export type CapturedCompartment = Readonly<{
  "evaluate": (code: string) => unknown;
}>;

type CompartmentImplementation = new (
  globals?: Readonly<Record<PropertyKey, unknown>>,
) => CapturedCompartment;

/* Capture bootstrap authorities before any cooperative TCB plugin can execute. */
const capturedLockdown: LockdownImplementation = lockdown;
const CapturedCompartmentConstructor: CompartmentImplementation = Compartment;
let capturedHarden: HardenImplementation | undefined;

let lockdownCompleted = false;

export function lockdownEnvironment(
  lockdownImplementation: LockdownImplementation = capturedLockdown,
  hardenImplementation?: HardenImplementation,
): void {
  if (lockdownCompleted) {
    return;
  }

  /* A thrown lockdown error deliberately leaves the sandbox runtime unavailable. */
  lockdownImplementation({ "evalTaming": "safe-eval" });
  capturedHarden = hardenImplementation ?? harden;
  lockdownCompleted = true;
}

export function hardenWithCapturedAuthority<Value>(value: Value): Value {
  if (capturedHarden === undefined) {
    throw new TypeError("SES harden authority is unavailable before successful lockdown");
  }

  return capturedHarden(value);
}

export function createCompartmentWithCapturedAuthority(
  globals: Readonly<Record<PropertyKey, unknown>>,
): CapturedCompartment {
  return new CapturedCompartmentConstructor(globals);
}

export function isEnvironmentLockdownCompleted(): boolean {
  return lockdownCompleted;
}

export function assertEnvironmentLockdownCompleted(): void {
  if (!lockdownCompleted) {
    throw new TypeError("Sandbox runtime requires a successfully completed SES lockdown");
  }
}

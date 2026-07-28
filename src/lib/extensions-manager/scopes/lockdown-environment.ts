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
const lockdownState: {
  "capturedHarden"?: HardenImplementation;
  "isCompleted"    : boolean;
} = { "isCompleted": false };

export function lockdownEnvironment(
  lockdownImplementation: LockdownImplementation = capturedLockdown,
  hardenImplementation?: HardenImplementation,
): void {
  if (lockdownState.isCompleted) {
    return;
  }

  /* A thrown lockdown error deliberately leaves the sandbox runtime unavailable. */
  lockdownImplementation({ "evalTaming": "safe-eval" });
  lockdownState.capturedHarden = hardenImplementation ?? harden;
  lockdownState.isCompleted = true;
}

export function hardenWithCapturedAuthority<Value>(value: Value): Value {
  if (lockdownState.capturedHarden === undefined) {
    throw new TypeError("SES harden authority is unavailable before successful lockdown");
  }

  return lockdownState.capturedHarden(value);
}

export function createCompartmentWithCapturedAuthority(
  globals: Readonly<Record<PropertyKey, unknown>>,
): CapturedCompartment {
  return new CapturedCompartmentConstructor(globals);
}

export function isEnvironmentLockdownCompleted(): boolean {
  return lockdownState.isCompleted;
}

export function assertEnvironmentLockdownCompleted(): void {
  if (!lockdownState.isCompleted) {
    throw new TypeError("Sandbox runtime requires a successfully completed SES lockdown");
  }
}

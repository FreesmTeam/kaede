import { describe, expect, it, vi } from "vitest";

import {
  createCompartmentWithCapturedAuthority,
  isEnvironmentLockdownCompleted,
  lockdownEnvironment,
} from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import { testHarden } from "@/lib/extensions-manager/scopes/sandbox-runtime.test-helpers.ts";

describe("lockdownEnvironment", () => {
  it("records completion only after safe-eval lockdown succeeds", () => {
    const failure = new Error("lockdown failed");
    const failingLockdown = vi.fn(() => {
      throw failure;
    });

    expect(isEnvironmentLockdownCompleted()).toBe(false);
    expect(() => lockdownEnvironment(failingLockdown)).toThrow(failure);
    expect(isEnvironmentLockdownCompleted()).toBe(false);

    const successfulLockdown = vi.fn();

    lockdownEnvironment(successfulLockdown, testHarden);
    lockdownEnvironment(successfulLockdown, testHarden);

    expect(successfulLockdown).toHaveBeenCalledOnce();
    expect(successfulLockdown).toHaveBeenCalledWith({ "evalTaming": "safe-eval" });
    expect(isEnvironmentLockdownCompleted()).toBe(true);
  });

  it("uses the Compartment authority captured before cooperative plugins", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Compartment");
    let poisonedConstructorCalled = false;

    Object.defineProperty(globalThis, "Compartment", {
      "configurable": true,
      "value"       : class PoisonedCompartment {
        constructor() {
          poisonedConstructorCalled = true;
        }
      },
      "writable": true,
    });

    try {
      const compartment = createCompartmentWithCapturedAuthority({ "answer": 42 });

      expect(compartment.evaluate("answer")).toBe(42);
      expect(poisonedConstructorCalled).toBe(false);
    } finally {
      if (originalDescriptor === undefined) {
        Reflect.deleteProperty(globalThis, "Compartment");
      } else {
        Object.defineProperty(globalThis, "Compartment", originalDescriptor);
      }
    }
  });
});

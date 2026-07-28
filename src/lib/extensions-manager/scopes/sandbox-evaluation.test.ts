import { describe, expect, it, vi } from "vitest";

import { runInSandbox } from "@/lib/extensions-manager/scopes/run-in-sandbox.ts";
import { testHarden } from "@/lib/extensions-manager/scopes/sandbox-runtime.test-helpers.ts";
import type {
  PermissionGrant,
  PermissionRequest,
} from "@/types/extensions/permission.type.ts";

describe("runInSandbox", () => {
  it("endows only scopedThis and requestPermissions and returns the result", () => {
    const scopedThis = testHarden({
      "logging/write": testHarden({ "write": (): void => {} }),
    });
    const requestPermissions = testHarden(async (): Promise<PermissionGrant> => ({
      "granted"     : [],
      "denied"      : [],
      "capabilities": {},
    }));
    const createCompartment = vi.fn((globals: object) => ({
      "evaluate": (code: string): string => `evaluated:${code}`,
      globals,
    }));
    const result = runInSandbox<string>({
      "code": "scopedThis['logging/write'].write('hello')",
      scopedThis,
      requestPermissions,
      createCompartment,
    });

    expect(result).toBe("evaluated:scopedThis['logging/write'].write('hello')");
    expect(createCompartment).toHaveBeenCalledOnce();
    const globals = createCompartment.mock.calls[0]?.[0];

    expect(Reflect.ownKeys(globals ?? {})).toEqual(["scopedThis", "requestPermissions"]);
    expect(globals).not.toHaveProperty("GrantedScopes");
    expect(globals).not.toHaveProperty("EventListeners");
    expect(globals).not.toHaveProperty("__options__");
  });

  it("runs async permission requests through a script-compatible IIFE", async () => {
    let requested: ReadonlyArray<PermissionRequest> | undefined;
    const requestPermissions = testHarden(async (
      permissions: ReadonlyArray<PermissionRequest>,
    ): Promise<PermissionGrant> => {
      requested = permissions;

      return testHarden({
        "granted"     : ["network/http"],
        "denied"      : [],
        "capabilities": {},
      });
    });
    const result = runInSandbox<Promise<boolean>>({
      "code": `
        (async () => {
          const grant = await requestPermissions([{
            id: "network/http",
            scope: {
              origins: ["https://api.example.com"],
              methods: ["GET"],
            },
          }]);

          return grant.granted.includes("network/http");
        })().catch((error) => {
          throw error;
        });
      `,
      "scopedThis": testHarden({}),
      requestPermissions,
    });

    await expect(result).resolves.toBe(true);
    expect(requested).toEqual([{
      "id"   : "network/http",
      "scope": {
        "origins": ["https://api.example.com"],
        "methods": ["GET"],
      },
    }]);
  });

  it("rejects mutable endowments", () => {
    const requestPermissions = testHarden(async (): Promise<PermissionGrant> => ({
      "granted"     : [],
      "denied"      : [],
      "capabilities": {},
    }));

    expect(() => runInSandbox({
      "code"             : "1",
      "scopedThis"       : {},
      requestPermissions,
      "createCompartment": () => ({
        "evaluate": (): number => 1,
      }),
    })).toThrow("deeply hardened");
  });

  it("rejects a shallow-frozen capability with mutable nested state", () => {
    const shallowFrozen = Object.freeze({
      "logging/write": { "write": (): void => {} },
    });
    const requestPermissions = testHarden(async (): Promise<PermissionGrant> => ({
      "granted"     : [],
      "denied"      : [],
      "capabilities": {},
    }));

    expect(() => runInSandbox({
      "code"             : "1",
      "scopedThis"       : shallowFrozen,
      requestPermissions,
      "createCompartment": () => ({ "evaluate": (): number => 1 }),
    })).toThrow("deeply hardened");
  });
});

import type { SafeDocument } from "ark-of-atrahasis";
import { describe, expect, it, vi } from "vitest";

import {
  cloneCapability,
} from "@/lib/extensions-manager/scopes/sandbox-grant-snapshot.ts";
import {
  ALL_URL_SINKS,
  NOOP_DISPOSE,
  testHarden,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.test-helpers.ts";
import {
  createSandboxRuntime,
  type SandboxMaxBounds,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";
import type { PermissionGrant } from "@/types/extensions/permission.type.ts";

class ReceiverAwareCapability {
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  write(suffix: string): string {
    return `${this.prefix}${suffix}`;
  }
}

describe("createSandboxRuntime security failures", () => {
  it("wraps callable authorities without exposing their own properties", () => {
    const writeDescriptor = Object.getOwnPropertyDescriptor(
      ReceiverAwareCapability.prototype,
      "write",
    );

    if (typeof writeDescriptor?.value !== "function") {
      throw new TypeError("Receiver-aware method descriptor is unavailable");
    }

    const original = writeDescriptor.value as ReceiverAwareCapability["write"];

    Object.defineProperty(original, "secret", { "value": "host authority" });

    const cloned = cloneCapability(original);
    const result = Reflect.apply(cloned, { "prefix": "sandbox:" }, ["ok"]);

    expect(result).toBe("sandbox:ok");
    expect(cloned).not.toBe(original);
    expect(Reflect.get(cloned, "secret")).toBeUndefined();
  });

  it("does not invoke the Ark loader when lockdown assertion fails", async () => {
    const loadArk = vi.fn();

    await expect(createSandboxRuntime({
      "trustedContainer"  : Object.create(null) as HTMLElement,
      "maxBounds"         : { "inlineSizePx": 100, "blockSizePx": 100 },
      "staticPermissions" : [],
      "requestPermissions": async () => ({
        "granted"     : [],
        "denied"      : [],
        "capabilities": {},
      }),
      "dependencies": {
        "assertLockdown": () => {
          throw new Error("not locked down");
        },
        loadArk,
      },
    })).rejects.toThrow("not locked down");
    expect(loadArk).not.toHaveBeenCalled();
  });

  it("rejects missing, extra, and accessor max-bound fields", async () => {
    const missing = Object.assign({} as SandboxMaxBounds, { "inlineSizePx": 100 });
    const extra = Object.assign({} as SandboxMaxBounds, {
      "inlineSizePx": 100,
      "blockSizePx" : 100,
      "unexpected"  : 100,
    });
    const accessor = Object.defineProperty(
      { "blockSizePx": 100 },
      "inlineSizePx",
      { "get": () => 100 },
    ) as SandboxMaxBounds;

    await Promise.all([missing, extra, accessor].map(async maxBounds => {
      await expect(createSandboxRuntime({
        "trustedContainer"  : Object.create(null) as HTMLElement,
        maxBounds,
        "staticPermissions" : [],
        "requestPermissions": async () => ({
          "granted"     : [],
          "denied"      : [],
          "capabilities": {},
        }),
      })).rejects.toThrow(/max bounds|own-data/u);
    }));
  });

  it("fails closed when a granted non-DOM capability factory is missing", async () => {
    let disposeDocumentCalls = 0;
    const disposeDocument = (): void => {
      disposeDocumentCalls += 1;
    };
    const removeHost = vi.fn();
    const safeDocument = testHarden(Object.assign({} as SafeDocument, {
      "dispose": disposeDocument,
    }));

    await expect(createSandboxRuntime({
      "trustedContainer"  : Object.create(null) as HTMLElement,
      "maxBounds"         : { "inlineSizePx": 100, "blockSizePx": 100 },
      "staticPermissions" : ["logging/write"],
      "requestPermissions": async () => ({
        "granted"     : [],
        "denied"      : [],
        "capabilities": {},
      }),
      "dependencies": {
        "assertLockdown": (): void => {},
        "loadArk"       : async () => ({
          "createSafeDocument"   : (): SafeDocument => safeDocument,
          "SAFE_STYLE_PROPERTIES": Object.freeze(["color"]),
          "URL_SINKS"            : ALL_URL_SINKS,
        }),
        "harden"            : testHarden,
        "createHostBoundary": () => Object.freeze({
          "root"  : Object.create(null) as ShadowRoot,
          "remove": removeHost,
        }),
      },
    })).rejects.toThrow("logging/write requires an injected broker capability factory");
    expect(disposeDocumentCalls).toBe(1);
    expect(removeHost).toHaveBeenCalledOnce();
  });

  it("reuses its SafeDocument for dynamic ui/basic and denies dynamic forms", async () => {
    const safeDocument = testHarden(Object.assign({} as SafeDocument, {
      "dispose": NOOP_DISPOSE,
    }));
    const fabricatedDocument = Object.setPrototypeOf(
      {} as SafeDocument,
      { "unsafe": true },
    );
    const createSafeDocument = vi.fn((): SafeDocument => safeDocument);
    const requestHostPermissions = vi.fn(async (): Promise<PermissionGrant> => ({
      "granted"     : ["ui/basic"],
      "denied"      : [],
      "capabilities": {
        "ui/basic": fabricatedDocument,
      },
    }));
    const runtime = await createSandboxRuntime({
      "trustedContainer"  : Object.create(null) as HTMLElement,
      "maxBounds"         : { "inlineSizePx": 100, "blockSizePx": 100 },
      "staticPermissions" : [],
      "requestPermissions": requestHostPermissions,
      "dependencies"      : {
        "assertLockdown": (): void => {},
        "loadArk"       : async () => ({
          createSafeDocument,
          "SAFE_STYLE_PROPERTIES": Object.freeze(["color"]),
          "URL_SINKS"            : ALL_URL_SINKS,
        }),
        "harden"            : testHarden,
        "createHostBoundary": () => Object.freeze({
          "root"  : Object.create(null) as ShadowRoot,
          "remove": (): void => {},
        }),
      },
    });

    const formsGrant = await runtime.requestPermissions(["ui/forms/non-credential"]);

    expect(formsGrant).toEqual({
      "granted"     : [],
      "denied"      : ["ui/forms/non-credential"],
      "capabilities": {},
    });
    expect(requestHostPermissions).not.toHaveBeenCalled();

    const basicGrant = await runtime.requestPermissions(["ui/basic"]);

    expect(requestHostPermissions).toHaveBeenCalledOnce();
    expect(basicGrant.capabilities["ui/basic"]).toBe(safeDocument);
    expect(basicGrant.capabilities["ui/basic"]).not.toBe(fabricatedDocument);
    expect(createSafeDocument).toHaveBeenCalledOnce();

    runtime.dispose();
  });

  it("rejects permission requests after or during disposal", async () => {
    const safeDocument = testHarden(Object.assign({} as SafeDocument, {
      "dispose": NOOP_DISPOSE,
    }));
    let resolveRequest: ((grant: PermissionGrant) => void) | undefined;
    const requestHostPermissions = vi.fn(() => new Promise<PermissionGrant>(resolve => {
      resolveRequest = resolve;
    }));
    const runtime = await createSandboxRuntime({
      "trustedContainer"  : Object.create(null) as HTMLElement,
      "maxBounds"         : { "inlineSizePx": 100, "blockSizePx": 100 },
      "staticPermissions" : [],
      "requestPermissions": requestHostPermissions,
      "dependencies"      : {
        "assertLockdown": (): void => {},
        "loadArk"       : async () => ({
          "createSafeDocument"   : (): SafeDocument => safeDocument,
          "SAFE_STYLE_PROPERTIES": Object.freeze(["color"]),
          "URL_SINKS"            : ALL_URL_SINKS,
        }),
        "harden"            : testHarden,
        "createHostBoundary": () => Object.freeze({
          "root"  : Object.create(null) as ShadowRoot,
          "remove": (): void => {},
        }),
      },
    });
    const pending = runtime.requestPermissions(["logging/write"]);

    expect(requestHostPermissions).toHaveBeenCalledOnce();
    runtime.dispose();
    resolveRequest?.({
      "granted"     : ["logging/write"],
      "denied"      : [],
      "capabilities": { "logging/write": { "write": (): void => {} } },
    });

    await expect(pending).rejects.toThrow("disposed during");
    await expect(runtime.requestPermissions(["logging/write"]))
      .rejects.toThrow("has been disposed");
    expect(requestHostPermissions).toHaveBeenCalledOnce();
  });
});

import type { SafeDocument, SafeDocumentOptions } from "ark-of-atrahasis";
import { describe, expect, it, vi } from "vitest";

import {
  ALL_URL_SINKS,
  testHarden,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.test-helpers.ts";
import {
  createSandboxRuntime,
  type StaticCapabilityFactories,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";
import type {
  LoggingCapability,
  NetworkHttpResponse,
  PermissionGrant,
  PermissionRequest,
  ProcessResult,
  ShellCapability,
} from "@/types/extensions/permission.type.ts";

type LoggingCapabilityFactory = NonNullable<
  StaticCapabilityFactories["logging/write"]
>;

const LOGGING_FACTORY_RETURNS_LOGGING_CAPABILITY = true satisfies (
  ReturnType<LoggingCapabilityFactory> extends LoggingCapability ? true : false
);
const LOGGING_FACTORY_REJECTS_SHELL_CAPABILITY = false satisfies (
  (() => ShellCapability) extends LoggingCapabilityFactory ? true : false
);

describe("createSandboxRuntime", () => {
  it("loads Ark after lockdown and fixes DOM policy from static permissions only", async () => {
    expect(LOGGING_FACTORY_RETURNS_LOGGING_CAPABILITY).toBe(true);
    expect(LOGGING_FACTORY_REJECTS_SHELL_CAPABILITY).toBe(false);
    const timeline: Array<string> = [];
    let disposeDocumentCalls = 0;
    const disposeDocument = (): void => {
      disposeDocumentCalls += 1;
    };
    const removeHost = vi.fn();
    const disposeEvents = vi.fn();
    const safeDocument = testHarden(Object.assign({} as SafeDocument, {
      "dispose": disposeDocument,
    }));
    let receivedDocumentOptions: SafeDocumentOptions | undefined;
    const createSafeDocument = vi.fn((
      _root: ShadowRoot,
      options: SafeDocumentOptions,
    ): SafeDocument => {
      timeline.push("document");
      receivedDocumentOptions = options;

      return safeDocument;
    });
    const staticLoggingCapability = {
      "write": (message: string): string => message,
    };
    const staticNetworkCapability = {
      "fetch": async (): Promise<NetworkHttpResponse> => ({
        "status"    : 200,
        "statusText": "OK",
        "headers"   : [],
        "body"      : [],
      }),
    };
    const staticPermissions = [
      "ui/basic",
      "ui/forms/non-credential",
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://static.example.test"],
          "methods": ["GET"],
        },
      },
      "logging/write",
      "system/shell",
    ] satisfies ReadonlyArray<PermissionRequest>;
    const dynamicGrant: PermissionGrant = {
      "granted"     : ["network/http"],
      "denied"      : [],
      "capabilities": {
        "network/http": {
          "fetch": async () => ({
            "status"    : 200,
            "statusText": "OK",
            "headers"   : [],
            "body"      : [],
          }),
        },
      },
    };
    const requestHostPermissions = vi.fn(async (): Promise<PermissionGrant> => dynamicGrant);
    const staticShellCapability = {
      "execute": async (): Promise<ProcessResult> => ({
        "code"  : 0,
        "signal": null,
        "stdout": [],
        "stderr": [],
      }),
    };
    const runtime = await createSandboxRuntime({
      "trustedContainer": Object.create(null) as HTMLElement,
      "maxBounds"       : {
        "inlineSizePx": 960,
        "blockSizePx" : 540,
      },
      staticPermissions,
      "requestPermissions"       : requestHostPermissions,
      "nonDOMCapabilityFactories": {
        "network/http" : () => staticNetworkCapability,
        "logging/write": () => staticLoggingCapability,
        "system/shell" : () => staticShellCapability,
      },
      disposeEvents,
      "dependencies": {
        "assertLockdown": (): void => {
          timeline.push("lockdown");
        },
        "loadArk": async () => {
          timeline.push("ark");

          return {
            createSafeDocument,
            "SAFE_STYLE_PROPERTIES": Object.freeze(["color", "width"]),
            "URL_SINKS"            : ALL_URL_SINKS,
          };
        },
        "harden"            : testHarden,
        "createHostBoundary": () => {
          timeline.push("host");

          return Object.freeze({
            "root"  : Object.create(null) as ShadowRoot,
            "remove": removeHost,
          });
        },
      },
    });

    expect(timeline).toEqual(["lockdown", "ark", "host", "document"]);
    expect(createSafeDocument).toHaveBeenCalledOnce();
    expect(receivedDocumentOptions?.stylePolicy?.allowedProperties).toEqual(["color", "width"]);
    expect(receivedDocumentOptions?.formControlPolicy).toEqual({
      "allowNonCredentialFormElements": true,
    });
    expect(Object.keys(receivedDocumentOptions?.urlPolicy?.sinks ?? {})).toEqual(ALL_URL_SINKS);
    expect(receivedDocumentOptions?.urlPolicy?.sinks["image.src"]?.allowedOrigins).toEqual([
      "https://static.example.test",
    ]);
    expect(Reflect.ownKeys(runtime.capabilities).toSorted((first, second) => {
      return String(first).localeCompare(String(second));
    })).toEqual([
      "logging/write",
      "network/http",
      "system/shell",
      "ui/basic",
    ]);
    expect(runtime.capabilities["ui/basic"]).toBe(safeDocument);
    expect(Object.isFrozen(runtime.capabilities)).toBe(true);
    expect(Object.isFrozen(runtime.capabilities["logging/write"])).toBe(true);
    expect(Object.isFrozen(staticLoggingCapability)).toBe(false);
    expect(Object.isFrozen(staticNetworkCapability)).toBe(false);
    expect(Object.isFrozen(staticShellCapability)).toBe(false);
    expect("createSafeDocument" in runtime).toBe(false);
    expect("root" in runtime).toBe(false);

    const dynamicResult = await runtime.requestPermissions([{
      "id"   : "network/http",
      "scope": {
        "origins": ["https://dynamic.example.test"],
        "methods": ["GET"],
      },
    }]);

    expect(createSafeDocument).toHaveBeenCalledOnce();
    expect(receivedDocumentOptions?.urlPolicy?.sinks["image.src"]?.allowedOrigins).toEqual([
      "https://static.example.test",
    ]);
    expect(dynamicResult).not.toBe(dynamicGrant);
    expect(dynamicResult.capabilities).not.toBe(dynamicGrant.capabilities);
    expect(Object.isFrozen(dynamicResult)).toBe(true);
    expect(Object.isFrozen(dynamicGrant)).toBe(false);
    expect(Object.isFrozen(dynamicGrant.capabilities)).toBe(false);

    runtime.dispose();
    runtime.dispose();

    expect(disposeDocumentCalls).toBe(1);
    expect(disposeEvents).toHaveBeenCalledOnce();
    expect(removeHost).toHaveBeenCalledOnce();
  });
});

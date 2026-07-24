import { describe, expect, it, vi } from "vitest";

import {
  artifact,
  createDependencies,
  createRuntimeFactory,
  createSession,
  initialize,
  metadata,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

function noOperation(): void {}

describe("Extension lifecycle concurrency", () => {
  it("treats immediate disposal as a barrier for an in-flight start", async () => {
    let releaseReads = noOperation;
    const reads = new Promise<void>(resolve => {
      releaseReads = resolve;
    });
    const harness = createDependencies();
    const controller = new ExtensionLifecycleController({
      ...harness.dependencies,
      "readAllExtensions": async (): Promise<ReadonlyArray<ExtensionInfoType>> => {
        await reads;

        return [artifact("plugin")];
      },
      "readAllMetadata": async (): Promise<ReadonlyArray<ExtensionMetadataType>> => {
        await reads;

        return [metadata("plugin")];
      },
    });
    const initialization = initialize(controller);

    await controller.dispose();
    releaseReads();

    await expect(initialization).rejects.toThrow("disposed during initialization");
    expect(harness.configure).not.toHaveBeenCalled();
    expect(harness.open).not.toHaveBeenCalled();
    expect(harness.lockdown).not.toHaveBeenCalled();
  });

  it("disposes a runtime that resolves after its session was revoked", async () => {
    let releaseRuntime = noOperation;
    const runtimeGate = new Promise<void>(resolve => {
      releaseRuntime = resolve;
    });
    const session = createSession();
    const runtime = createRuntimeFactory();
    const harness = createDependencies({
      "session"       : session.session,
      "runtimeFactory": async options => {
        const handle = await runtime.create(options);

        await runtimeGate;

        return handle;
      },
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);
    const initialization = initialize(controller);

    await vi.waitFor(() => {
      expect(runtime.disposes).toHaveLength(1);
    });
    await controller.dispose();
    releaseRuntime();

    await expect(initialization).rejects.toThrow("disposed during initialization");
    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(session.revoke).toHaveBeenCalledOnce();
  });

  it("cleans once and blocks a sibling request after a partial grant failure", async () => {
    const session = createSession();
    const runtime = createRuntimeFactory();
    let grantCount = 0;
    let requestCount = 0;
    let resolveSecond: ((decisions: ReadonlyArray<boolean>) => void) | undefined;
    let siblingError: unknown;
    const secondDecision = new Promise<ReadonlyArray<boolean>>(resolve => {
      resolveSecond = resolve;
    });
    const grant = vi.fn(async (): Promise<void> => {
      grantCount++;

      if (grantCount === 2) {
        throw new Error("partial grant failed");
      }
    });
    const harness = createDependencies({
      "session": Object.freeze({
        ...session.session,
        grant,
      }),
      "runtimeFactory": runtime.create,
      "requestDynamic": async (): Promise<ReadonlyArray<boolean>> => {
        requestCount++;

        return requestCount === 1 ? [true, true] : secondDecision;
      },
      "runSandbox": async options => {
        const failing = options.requestPermissions(["logging/write", "ui/basic"]);
        const sibling = options.requestPermissions(["logging/write"]);
        const failure = await failing.then(
          (): unknown => undefined,
          (error: unknown): unknown => error,
        );

        resolveSecond?.([true]);
        siblingError = await sibling.then(
          (): unknown => undefined,
          (error: unknown): unknown => error,
        );

        throw failure;
      },
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(grant).toHaveBeenCalledTimes(2);
    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(harness.revokeEvents).toHaveBeenCalledOnce();
    expect(session.revoke).toHaveBeenCalledOnce();
    expect(siblingError).toEqual(expect.objectContaining({
      "message": "Sandbox session is no longer active",
    }));
  });
});

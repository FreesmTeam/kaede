import { describe, expect, it, vi } from "vitest";

import {
  createDependencies,
  createRuntimeFactory,
  createSession,
  initialize,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";

function noOperation(): void {}

describe("Extension lifecycle cleanup", () => {
  it("blocks replacement until a failed sandbox revocation succeeds", async () => {
    const oldSession = createSession();
    const replacementSession = createSession();
    const runtime = createRuntimeFactory();
    const revocationError = new Error("process termination failed");
    const oldRevoke = vi.fn(async (): Promise<void> => {})
      .mockRejectedValueOnce(revocationError);
    const sessions = [
      Object.freeze({ ...oldSession.session, "revoke": oldRevoke }),
      replacementSession.session,
    ];
    const harness = createDependencies({ "runtimeFactory": runtime.create });
    const openPluginSession = vi.fn(async () => {
      const session = sessions.shift();

      if (session === undefined) {
        throw new TypeError("Unexpected plugin session request");
      }

      return session;
    });
    const controller = new ExtensionLifecycleController({
      ...harness.dependencies,
      openPluginSession,
    });

    await initialize(controller);
    await expect(initialize(controller)).rejects.toThrow(
      "Sandbox cleanup remains incomplete for 1 broker session(s)",
    );

    expect(oldRevoke).toHaveBeenCalledOnce();
    expect(replacementSession.revoke).not.toHaveBeenCalled();
    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(openPluginSession).toHaveBeenCalledOnce();
    expect(harness.reportError).toHaveBeenCalledWith(
      "Failed to revoke the 'plugin' broker session",
      revocationError,
    );

    await initialize(controller);
    await controller.dispose();

    expect(oldRevoke).toHaveBeenCalledTimes(2);
    expect(replacementSession.revoke).toHaveBeenCalledOnce();
    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(openPluginSession).toHaveBeenCalledTimes(2);
  });

  it("retries an incomplete sandbox revocation on a later dispose", async () => {
    const session = createSession();
    const revocationError = new Error("process termination failed");
    const revoke = vi.fn(async (): Promise<void> => {})
      .mockRejectedValueOnce(revocationError);
    const harness = createDependencies({
      "session": Object.freeze({ ...session.session, revoke }),
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);
    await expect(controller.dispose()).rejects.toThrow(
      "Sandbox cleanup remains incomplete for 1 broker session(s)",
    );

    expect(revoke).toHaveBeenCalledOnce();
    expect(harness.reportError).toHaveBeenCalledWith(
      "Failed to revoke the 'plugin' broker session",
      revocationError,
    );

    await expect(controller.dispose()).resolves.toBeUndefined();

    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it("keeps retrying cleanup after its owner requests disposal only once", async () => {
    const session = createSession();
    const revocationError = new Error("process termination failed");
    const revoke = vi.fn(async (): Promise<void> => {})
      .mockRejectedValueOnce(revocationError);
    const harness = createDependencies({
      "session": Object.freeze({ ...session.session, revoke }),
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);
    await expect(controller.disposeUntilClean(0)).resolves.toBeUndefined();

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(harness.reportError).toHaveBeenCalledWith(
      "Sandbox cleanup is incomplete and will be retried",
      expect.objectContaining({
        "message": "Sandbox cleanup remains incomplete for 1 broker session(s)",
      }),
    );
  });

  it("blocks a replacement initialization until retained cleanup succeeds", async () => {
    let releaseRetry = noOperation;
    const retryGate = new Promise<void>(resolve => {
      releaseRetry = resolve;
    });
    const oldSession = createSession();
    const replacementSession = createSession();
    const oldRevoke = vi.fn(async (): Promise<void> => {})
      .mockRejectedValueOnce(new Error("process termination failed"))
      .mockImplementationOnce(async (): Promise<void> => retryGate);
    const sessions = [
      Object.freeze({ ...oldSession.session, "revoke": oldRevoke }),
      replacementSession.session,
    ];
    const harness = createDependencies();
    const openPluginSession = vi.fn(async () => {
      const session = sessions.shift();

      if (session === undefined) {
        throw new TypeError("Unexpected plugin session request");
      }

      return session;
    });
    const controller = new ExtensionLifecycleController({
      ...harness.dependencies,
      openPluginSession,
    });

    await initialize(controller);
    const cleanup = controller.disposeUntilClean(0);
    const replacement = initialize(controller);

    await vi.waitFor(() => {
      expect(oldRevoke).toHaveBeenCalledTimes(2);
    });
    expect(openPluginSession).toHaveBeenCalledOnce();

    releaseRetry();
    await cleanup;
    await replacement;
    await controller.dispose();

    expect(openPluginSession).toHaveBeenCalledTimes(2);
    expect(replacementSession.revoke).toHaveBeenCalledOnce();
  });
});

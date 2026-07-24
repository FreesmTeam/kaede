import { describe, expect, it, vi } from "vitest";

import { GlobalObject } from "@/extendable/global-object.ts";
import { DirectHost, Host } from "@/lib/capability-broker";
import {
  createDependencies,
  createRuntimeFactory,
  createSession,
  initialize,
  metadata,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  createTrustedExtensionContext,
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import { runInUnrestricted } from "@/lib/extensions-manager/scopes/run-in-unrestricted.ts";
import {
  TRUSTED_ARTIFACT_CATALOG,
} from "@/lib/extensions-manager/scopes/trusted-artifact-catalog.ts";
import type { PermissionGrant } from "@/types/extensions/permission.type.ts";

describe("ExtensionLifecycleController", () => {
  it("lets the real planner reject community unrestricted code before execution", async () => {
    const runTrusted = vi.fn(async (): Promise<void> => {});
    const runSandbox = vi.fn();
    const harness = createDependencies({
      "metadataEntries": [metadata("plugin", { "type": "unrestricted" })],
      runTrusted,
      runSandbox,
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await expect(initialize(controller)).rejects.toThrow(
      "Untrusted unrestricted plugin is forbidden",
    );
    expect(runTrusted).not.toHaveBeenCalled();
    expect(runSandbox).not.toHaveBeenCalled();
    expect(harness.open).not.toHaveBeenCalled();
    expect(harness.lockdown).not.toHaveBeenCalled();
  });

  it("does not open a broker session when the static prompt is cancelled", async () => {
    const harness = createDependencies({
      "requestStatic": async (): Promise<boolean> => false,
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(harness.configure).toHaveBeenCalledOnce();
    expect(harness.configureEvents).toHaveBeenCalledOnce();
    expect(harness.open).not.toHaveBeenCalled();
  });

  it("grants the complete normalized static set before sandbox evaluation", async () => {
    const order: Array<string> = [];
    const session = createSession(order);
    const runtime = createRuntimeFactory(order);
    const runSandbox = vi.fn((): void => {
      order.push("evaluate");
    });
    const harness = createDependencies({
      "metadataEntries": [metadata("plugin", {
        "permissions": ["logging/write", "ui/basic"],
      })],
      "session"       : session.session,
      "runtimeFactory": runtime.create,
      runSandbox,
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(session.grantAll).toHaveBeenCalledWith([
      { "descriptor": "logging/write", "targetIdentities": [] },
      { "descriptor": "ui/basic", "targetIdentities": [] },
    ]);
    expect(order).toEqual(["grant-static", "evaluate"]);
  });

  it("maps dynamic decisions to exact broker grants and non-DOM factories", async () => {
    const session = createSession();
    let dynamicGrant: PermissionGrant | undefined;
    const runSandbox = vi.fn(async options => {
      dynamicGrant = await options.requestPermissions([
        "logging/write",
        "system/shell",
        "ui/basic",
      ]);
    });
    const harness = createDependencies({
      "requestDynamic": async (): Promise<ReadonlyArray<boolean>> => [true, false, true],
      "session"       : session.session,
      runSandbox,
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(session.grant).toHaveBeenCalledTimes(2);
    expect(session.grant).toHaveBeenNthCalledWith(1, {
      "descriptor": "logging/write", "targetIdentities": [],
    });
    expect(session.grant).toHaveBeenNthCalledWith(2, {
      "descriptor": "ui/basic", "targetIdentities": [],
    });
    expect(dynamicGrant?.granted).toEqual(["logging/write", "ui/basic"]);
    expect(dynamicGrant?.denied).toEqual(["system/shell"]);
    expect(Reflect.ownKeys(dynamicGrant?.capabilities ?? {})).toEqual(["logging/write"]);
    expect(dynamicGrant).not.toHaveProperty("token");
    expect(dynamicGrant).not.toHaveProperty("invoke");
    expect(Object.isFrozen(dynamicGrant)).toBe(true);
  });

  it("disposes runtime and events before revoking sessions on replacement and unload", async () => {
    const order: Array<string> = [];
    const session = createSession(order);
    const runtime = createRuntimeFactory(order);
    const harness = createDependencies({
      "session"             : session.session,
      "runtimeFactory"      : runtime.create,
      "revokeEventsCallback": (): void => {
        order.push("events");
      },
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);
    await initialize(controller);

    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(order.slice(1, 4)).toEqual(["dispose", "events", "revoke"]);

    await controller.dispose();

    expect(runtime.disposes[1]).toHaveBeenCalledOnce();
    expect(session.revoke).toHaveBeenCalledTimes(2);
    expect(harness.cancel).toHaveBeenCalledWith(expect.objectContaining({
      "pluginId": "plugin",
    }));
  });

  it("rolls back runtime, events, and session after a partial dynamic grant failure", async () => {
    const session = createSession();
    const runtime = createRuntimeFactory();
    let grantCount = 0;
    const grant = vi.fn(async (): Promise<void> => {
      grantCount++;

      if (grantCount === 2) {
        throw new Error("second broker grant failed");
      }
    });
    const partialSession = Object.freeze({
      ...session.session,
      grant,
    });
    const harness = createDependencies({
      "session"       : partialSession,
      "runtimeFactory": runtime.create,
      "requestDynamic": async (): Promise<ReadonlyArray<boolean>> => [true, true],
      "runSandbox"    : async options => {
        await options.requestPermissions(["logging/write", "ui/basic"]);
      },
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(grant).toHaveBeenCalledTimes(2);
    expect(runtime.disposes[0]).toHaveBeenCalledOnce();
    expect(harness.revokeEvents).toHaveBeenCalledOnce();
    expect(session.revoke).toHaveBeenCalledOnce();
    expect(harness.reportError).toHaveBeenCalledWith(
      "Failed to initialize the 'plugin' sandboxed extension",
      expect.objectContaining({ "message": "second broker grant failed" }),
    );
  });

  it("passes trusted authority explicitly without installing it on window", async () => {
    const previousRippleColor = GlobalObject.variables.rippleColor;
    const context = createTrustedExtensionContext({
      Host,
      DirectHost,
      "Kaede": GlobalObject,
    });

    try {
      await runInUnrestricted({
        "id"  : "trusted",
        "code": `
          scopedThis.Kaede.variables.rippleColor =
            scopedThis.Host === this.Host && scopedThis.DirectHost === this.DirectHost
              ? "explicit-trusted-context"
              : "missing-context";
        `,
        context,
      });

      expect(GlobalObject.variables.rippleColor).toBe("explicit-trusted-context");
      expect(window).not.toHaveProperty("Host");
      expect(window).not.toHaveProperty("DirectHost");
      expect(window).not.toHaveProperty("session");
      expect(window).not.toHaveProperty("token");
    } finally {
      GlobalObject.variables.rippleColor = previousRippleColor;
    }
  });

  it("runs an exact catalog artifact before lockdown", async () => {
    const trustedArtifact = TRUSTED_ARTIFACT_CATALOG[0];

    if (trustedArtifact === undefined) {
      throw new TypeError("The trusted artifact catalog must not be empty");
    }

    const executed: Array<string> = [];
    const artifacts = [{
      "id"            : trustedArtifact.pluginId,
      "code"          : "reviewed artifact bytes",
      "artifactSha256": trustedArtifact.artifactSha256,
    }];
    const metadataEntries = [metadata(trustedArtifact.pluginId, {
      "type"   : "unrestricted",
      "source" : "https://raw.githubusercontent.com/kaede-basement/trusted-extensions/main/plugins/typescript-chan.js",
      "version": trustedArtifact.version,
    })];
    const harness = createDependencies({
      artifacts,
      metadataEntries,
      "runTrusted": async options => {
        executed.push(options.id);
      },
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);

    await initialize(controller);

    expect(executed).toEqual([trustedArtifact.pluginId]);
    expect(harness.revokeGlobals).toHaveBeenCalledOnce();
    expect(harness.lockdown).toHaveBeenCalledOnce();
  });
});

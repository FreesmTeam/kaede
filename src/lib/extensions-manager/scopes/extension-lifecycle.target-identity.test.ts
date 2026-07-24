import { describe, expect, test } from "vitest";

import type {
  PermissionTargetKind,
  PreparedPermissionRequest,
} from "@/lib/capability-broker";
import {
  createDependencies,
  createSession,
  initialize,
  metadata,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import { waitForPrompt } from
  "@/lib/extensions-manager/scopes/permission-prompts.test-helpers.ts";
import {
  InMemoryPermissionDecisionStore,
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

type TargetCase = Readonly<{
  "kind"       : PermissionTargetKind;
  "lexicalPath": string;
  "permission" : PermissionRequest;
  "targetA"    : string;
  "targetB"    : string;
}>;

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function preparedTarget(
  fixture: TargetCase,
  path: string,
  inode: string,
  contentSha256 = SHA_A,
): PreparedPermissionRequest {
  const descriptor: PermissionRequest = fixture.kind === "external_storage_root"
    ? {
      "id"   : "storage/external/read",
      "scope": { "roots": [path] },
    }
    : {
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ path, "arguments": ["--version"] }] },
    };

  const targetIdentity = fixture.kind === "external_storage_root"
    ? Object.freeze({
      "kind"            : fixture.kind,
      path,
      "identityProvider": "desktop-filesystem-v1" as const,
      "device"          : "7",
      inode,
    })
    : Object.freeze({
      "kind"            : fixture.kind,
      path,
      "identityProvider": "desktop-executable-sha256-v1" as const,
      "device"          : "7",
      inode,
      contentSha256,
    });

  return Object.freeze({
    descriptor,
    "targetIdentities": Object.freeze([targetIdentity]),
  });
}

function lifecycleLaunch(
  fixture: TargetCase,
  prepared: PreparedPermissionRequest,
  store: InMemoryPermissionDecisionStore,
): Readonly<{
  "controller": ExtensionLifecycleController;
  "initialize": Promise<void>;
  "prompts"   : PermissionPromptController;
  "session"   : ReturnType<typeof createSession>;
}> {
  const prompts = new PermissionPromptController(store);
  const session = createSession();
  const harness = createDependencies({
    "metadataEntries"   : [metadata("plugin", { "permissions": [fixture.permission] })],
    "session"           : session.session,
    "preparePermissions": async requests => {
      expect(requests).toEqual([fixture.permission]);

      return [prepared];
    },
    "requestStatic"       : (principal, requests) => prompts.requestStatic(principal, requests),
    "requestDynamic"      : (principal, requests) => prompts.requestDynamic(principal, requests),
    "revokeEventsCallback": (): void => prompts.cancelAll(),
  });
  const controller = new ExtensionLifecycleController(harness.dependencies);

  return Object.freeze({
    controller,
    "initialize": initialize(controller),
    prompts,
    session,
  });
}

async function settlePromptQueue(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await Promise.resolve();
  }
}

describe.each([
  {
    "kind"       : "external_storage_root",
    "lexicalPath": "/fixture/storage-link",
    "permission" : {
      "id"   : "storage/external/read",
      "scope": { "roots": ["/fixture/storage-link"] },
    },
    "targetA": "/fixture/storage-a",
    "targetB": "/fixture/storage-b",
  },
  {
    "kind"       : "process_executable",
    "lexicalPath": "/fixture/tool-link",
    "permission" : {
      "id"   : "system/process/spawn",
      "scope": {
        "executables": [{ "path": "/fixture/tool-link", "arguments": ["--version"] }],
      },
    },
    "targetA": "/fixture/tool-a",
    "targetB": "/fixture/tool-b",
  },
] satisfies ReadonlyArray<TargetCase>)("remembered $kind identity", fixture => {
  test("survives an unchanged lifecycle and prompts again after symlink retargeting", async () => {
    const store = new InMemoryPermissionDecisionStore;
    const firstPrepared = preparedTarget(fixture, fixture.targetA, "101");
    const first = lifecycleLaunch(fixture, firstPrepared, store);
    const firstPrompt = await waitForPrompt(first.prompts);

    expect(firstPrompt.requests).toEqual([firstPrepared]);
    first.prompts.resolveStatic(true);
    await first.initialize;
    expect(first.session.grantAll).toHaveBeenCalledWith([firstPrepared]);
    await first.controller.dispose();

    const unchangedPrepared = preparedTarget(fixture, fixture.targetA, "101");
    const unchanged = lifecycleLaunch(fixture, unchangedPrepared, store);

    await settlePromptQueue();
    expect(unchanged.prompts.currentPrompt).toBeUndefined();
    await unchanged.initialize;
    expect(unchanged.session.grantAll).toHaveBeenCalledWith([unchangedPrepared]);
    await unchanged.controller.dispose();

    const retargetedPrepared = preparedTarget(fixture, fixture.targetB, "202");
    const retargeted = lifecycleLaunch(fixture, retargetedPrepared, store);
    const retargetedPrompt = await waitForPrompt(retargeted.prompts);

    expect(retargetedPrompt.requests).toEqual([retargetedPrepared]);
    expect(retargetedPrompt.fingerprint).not.toBe(firstPrompt.fingerprint);
    expect(retargeted.session.grantAll).not.toHaveBeenCalled();
    retargeted.prompts.resolveStatic(false);
    await retargeted.initialize;
    expect(retargeted.session.grantAll).not.toHaveBeenCalled();
  });

  if (fixture.kind === "process_executable") {
    test("prompts again when executable bytes change without replacing the inode", async () => {
      const store = new InMemoryPermissionDecisionStore;
      const firstPrepared = preparedTarget(fixture, fixture.targetA, "101", SHA_A);
      const first = lifecycleLaunch(fixture, firstPrepared, store);
      const firstPrompt = await waitForPrompt(first.prompts);

      first.prompts.resolveStatic(true);
      await first.initialize;
      await first.controller.dispose();

      const overwrittenPrepared = preparedTarget(fixture, fixture.targetA, "101", SHA_B);
      const overwritten = lifecycleLaunch(fixture, overwrittenPrepared, store);
      const overwrittenPrompt = await waitForPrompt(overwritten.prompts);

      expect(overwrittenPrompt.fingerprint).not.toBe(firstPrompt.fingerprint);
      expect(overwritten.session.grantAll).not.toHaveBeenCalled();
      overwritten.prompts.resolveStatic(false);
      await overwritten.initialize;
    });
  }
});

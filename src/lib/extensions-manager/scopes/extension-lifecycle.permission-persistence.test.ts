import { expect, test, vi } from "vitest";

import {
  createDependencies,
  createSession,
  initialize,
  metadata,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import {
  waitForPrompt,
} from "@/lib/extensions-manager/scopes/permission-prompts.test-helpers.ts";
import {
  type PermissionDecisionStore,
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";

test("a rejected static decision save surfaces before plugin grant or evaluation", async () => {
  const persistenceError = new Error("permission decision disk is unavailable");
  const store: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": async () => {
      throw persistenceError;
    },
  };
  const prompts = new PermissionPromptController(store);
  const session = createSession();
  const runSandbox = vi.fn();
  const harness = createDependencies({
    "metadataEntries": [metadata("plugin", { "permissions": ["logging/write"] })],
    "session"        : session.session,
    runSandbox,
    "requestStatic"  : (principal, requests) => prompts.requestStatic(principal, requests),
    "requestDynamic" : (principal, requests) => prompts.requestDynamic(principal, requests),
  });
  const controller = new ExtensionLifecycleController(harness.dependencies);
  const initialization = initialize(controller);

  await waitForPrompt(prompts);
  prompts.resolveStatic(true);

  await expect(initialization).rejects.toBe(persistenceError);
  expect(harness.open).not.toHaveBeenCalled();
  expect(session.grantAll).not.toHaveBeenCalled();
  expect(runSandbox).not.toHaveBeenCalled();
});

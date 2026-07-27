import { expect, test } from "vitest";

import {
  BASIC_UI,
  LOGGING,
  principal,
  waitForPrompt,
} from "@/lib/extensions-manager/scopes/permission-prompts.test-helpers.ts";
import {
  configurePermissionDecisionStore,
  getDynamicBatchDecisions,
  InMemoryPermissionDecisionStore,
  type PermissionDecisionStore,
  PermissionPromptController,
  permissionPromptController,
  reconcileDynamicDraftDecisions,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

test("batch decisions override drafts but preserve remembered positions", () => {
  const remembered = [undefined, true, undefined, false] as const;

  expect(getDynamicBatchDecisions(remembered, false)).toEqual([
    false,
    true,
    false,
    false,
  ]);
  expect(getDynamicBatchDecisions(remembered, true)).toEqual([
    true,
    true,
    true,
    false,
  ]);
});

test("remembered drafts reconcile conflicting duplicate fingerprints", () => {
  expect(reconcileDynamicDraftDecisions(
    [BASIC_UI, BASIC_UI, LOGGING],
    [true, false, undefined],
  )).toEqual([true, true, undefined]);
});

test("dynamic prompt batches expose a bounded DOM fingerprint", async () => {
  const controller = new PermissionPromptController;
  const requests: ReadonlyArray<PermissionRequest> = Array.from(
    { "length": 100 },
    () => BASIC_UI,
  );
  const pending = controller.requestDynamic(principal("a"), requests);
  const prompt = await waitForPrompt(controller);

  expect(prompt.kind).toBe("dynamic");
  expect(prompt.fingerprint).toMatch(
    /^dynamic-permission-batch-v2:sha256:[a-f0-9]{64}$/u,
  );
  expect((new TextEncoder).encode(prompt.fingerprint).byteLength).toBeLessThan(128);

  controller.resolveDynamic(requests.map(() => false));
  await expect(pending).resolves.toEqual(requests.map(() => false));
});

test("singleton store configuration is used by the first request", async () => {
  let loadCount = 0;
  let saveCount = 0;
  const store: PermissionDecisionStore = {
    "load": (): undefined => {
      loadCount++;

      return;
    },
    "save": (): void => {
      saveCount++;
    },
  };

  configurePermissionDecisionStore(store);

  const request = permissionPromptController.requestStatic(
    principal("d", "configured-singleton"),
    [BASIC_UI],
  );

  await waitForPrompt(permissionPromptController);
  permissionPromptController.resolveStatic(true);
  await expect(request).resolves.toBe(true);
  expect({ loadCount, saveCount }).toEqual({ "loadCount": 1, "saveCount": 1 });

  await Promise.resolve();
  configurePermissionDecisionStore((new InMemoryPermissionDecisionStore));
});

test("decision store cannot be reconfigured while a prompt is active", async () => {
  const controller = (new PermissionPromptController);
  const pending = controller.requestDynamic(principal("a"), [BASIC_UI]);

  await waitForPrompt(controller);
  expect(() => controller.setDecisionStore((new InMemoryPermissionDecisionStore))).toThrow(
    "Cannot configure the decision store while prompts are active or queued",
  );

  controller.resolveDynamic([false]);
  await expect(pending).resolves.toEqual([false]);
  await Promise.resolve();
  expect(() => controller.setDecisionStore((new InMemoryPermissionDecisionStore))).not.toThrow();
});

test("idle store reconfiguration clears the controller decision cache", async () => {
  const firstStore = (new InMemoryPermissionDecisionStore);
  const secondStore = (new InMemoryPermissionDecisionStore);
  const controller = new PermissionPromptController(firstStore);
  const plugin = principal("a");
  const initial = controller.requestStatic(plugin, [BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveStatic(true);
  await expect(initial).resolves.toBe(true);
  await Promise.resolve();
  controller.setDecisionStore(secondStore);

  const afterReconfigure = controller.requestStatic(plugin, [BASIC_UI]);
  const afterReconfigurePrompt = await waitForPrompt(controller);

  expect(afterReconfigurePrompt.kind).toBe("static");
  controller.resolveStatic(false);
  await expect(afterReconfigure).resolves.toBe(false);

  const repeated = controller.requestStatic(plugin, [BASIC_UI]);

  await expect(repeated).resolves.toBe(false);
  expect(controller.currentPrompt).toBeUndefined();
});

test("a stale load cannot repopulate cache after store reconfiguration", async () => {
  let resolveOldLoad: ((decision: boolean | undefined) => void) | undefined;
  const oldStore: PermissionDecisionStore = {
    "load": async () => await new Promise<boolean | undefined>(resolve => {
      resolveOldLoad = resolve;
    }),
    "save": (): void => {},
  };
  const controller = new PermissionPromptController(oldStore);
  const plugin = principal("a");
  const pending = controller.requestStatic(plugin, [BASIC_UI]);

  await Promise.resolve();
  expect(resolveOldLoad).toBeDefined();
  expect(controller.currentPrompt).toBeUndefined();
  expect(() => controller.setDecisionStore(new InMemoryPermissionDecisionStore)).toThrow(
    "Cannot configure the decision store while prompts are active or queued",
  );
  controller.cancelAll();
  await expect(pending).resolves.toBe(false);
  await Promise.resolve();
  controller.setDecisionStore((new InMemoryPermissionDecisionStore));

  resolveOldLoad?.(true);

  for (let attempt = 0; attempt < 3; attempt++) {
    await Promise.resolve();
  }

  const afterReconfigure = controller.requestStatic(plugin, [BASIC_UI]);
  const prompt = await waitForPrompt(controller);

  expect(prompt.kind).toBe("static");
  controller.resolveStatic(false);
  await expect(afterReconfigure).resolves.toBe(false);
});

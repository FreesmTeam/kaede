import { expect, test } from "vitest";

import {
  BASIC_UI,
  LOGGING,
  principal,
  SHELL,
  waitForPrompt,
} from "@/lib/extensions-manager/scopes/permission-prompts.test-helpers.ts";
import {
  InMemoryPermissionDecisionStore,
  type PermissionDecisionStore,
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";

test("concurrent requests are resolved in strict FIFO order", async () => {
  const controller = (new PermissionPromptController);
  const shownPluginIds: Array<string> = [];

  controller.subscribe(prompt => {
    if (prompt !== undefined) {
      shownPluginIds.push(prompt.principal.pluginId);
    }
  });

  const first = controller.requestStatic(principal("a", "first"), [BASIC_UI]);
  const second = controller.requestDynamic(principal("b", "second"), [LOGGING, BASIC_UI]);
  const third = controller.requestStatic(principal("c", "third"), [SHELL]);

  const firstPrompt = await waitForPrompt(controller);

  expect(firstPrompt.principal.pluginId).toBe("first");
  expect(controller.resolveStatic(true)).toBe(true);
  await expect(first).resolves.toBe(true);

  const secondPrompt = await waitForPrompt(controller);

  expect(secondPrompt.principal.pluginId).toBe("second");
  expect(controller.resolveDynamic([false, true])).toBe(true);
  await expect(second).resolves.toEqual([false, true]);

  const thirdPrompt = await waitForPrompt(controller);

  expect(thirdPrompt.principal.pluginId).toBe("third");
  expect(controller.resolveStatic(false)).toBe(true);

  await expect(Promise.all([first, second, third])).resolves.toEqual([
    true,
    [false, true],
    false,
  ]);
  expect(shownPluginIds).toEqual(["first", "second", "third"]);
});

test("cancelAll safely denies matching active and queued requests", async () => {
  const controller = (new PermissionPromptController);
  const cancelledPlugin = principal("a", "cancelled");
  const survivingPlugin = principal("b", "surviving");
  const active = controller.requestStatic(cancelledPlugin, [BASIC_UI]);
  const queued = controller.requestDynamic(cancelledPlugin, [LOGGING]);
  const surviving = controller.requestDynamic(survivingPlugin, [SHELL]);

  await waitForPrompt(controller);
  controller.cancelAll(cancelledPlugin);

  await expect(active).resolves.toBe(false);
  await expect(queued).resolves.toEqual([false]);
  const survivingPrompt = await waitForPrompt(controller);

  expect(survivingPrompt.principal.pluginId).toBe("surviving");

  controller.resolveDynamic([true]);
  await expect(surviving).resolves.toEqual([true]);
});

test("cancelAll does not wait for a stalled decision adapter", async () => {
  const stalledStore: PermissionDecisionStore = {
    "load": async () => await new Promise<boolean | undefined>(() => {}),
    "save": (): void => {},
  };
  const controller = new PermissionPromptController(stalledStore);
  const pending = controller.requestStatic(principal("a"), [BASIC_UI]);
  let result: boolean | undefined;

  void pending.then(decision => {
    result = decision;
  });
  await Promise.resolve();
  controller.cancelAll();

  for (let attempt = 0; attempt < 5; attempt++) {
    await Promise.resolve();
  }

  expect(result).toBe(false);
});

test("cancellation and store replacement cannot commit an in-flight save to session", async () => {
  const savedDecisions: Array<boolean> = [];
  let finishSave: (() => void) | undefined;
  const stalledSaveStore: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": async (_key, decision) => {
      savedDecisions.push(decision);
      await new Promise<void>(resolve => {
        finishSave = resolve;
      });
    },
  };
  const controller = new PermissionPromptController(stalledSaveStore);
  const plugin = principal("a");
  const cancelled = controller.requestStatic(plugin, [BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveStatic(true);
  controller.cancelAll();

  await expect(cancelled).resolves.toBe(false);
  expect(savedDecisions).toEqual([]);

  const accepted = controller.requestStatic(plugin, [BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveStatic(true);

  for (let attempt = 0; attempt < 5 && savedDecisions.length === 0; attempt++) {
    await Promise.resolve();
  }

  expect(savedDecisions).toEqual([true]);
  expect(() => controller.setDecisionStore(new InMemoryPermissionDecisionStore)).toThrow(
    "Cannot configure the decision store while prompts are active or queued",
  );
  controller.cancelAll();
  await expect(accepted).resolves.toBe(false);

  const replacementStore = new InMemoryPermissionDecisionStore;

  await Promise.resolve();
  controller.setDecisionStore(replacementStore);
  finishSave?.();

  for (let attempt = 0; attempt < 5; attempt++) {
    await Promise.resolve();
  }

  const repeated = controller.requestStatic(plugin, [BASIC_UI]);
  const repeatedPrompt = await waitForPrompt(controller);

  controller.resolveStatic(false);
  await expect(repeated).resolves.toBe(false);
  expect(repeatedPrompt.kind).toBe("static");
  expect(savedDecisions).toEqual([true]);
});

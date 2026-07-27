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

test("remembered dynamic decisions retain their requested positions", async () => {
  const store = (new InMemoryPermissionDecisionStore);
  const controller = new PermissionPromptController(store);
  const plugin = principal("a");
  const rememberedRequest = controller.requestDynamic(plugin, [BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveDynamic([true], true);
  await expect(rememberedRequest).resolves.toEqual([true]);

  const mixedRequest = controller.requestDynamic(plugin, [LOGGING, BASIC_UI]);
  const prompt = await waitForPrompt(controller);

  expect(prompt.kind).toBe("dynamic");

  if (prompt.kind !== "dynamic") {
    throw new Error("Expected a dynamic permission prompt");
  }

  expect(prompt.rememberedDecisions).toEqual([undefined, true]);
  controller.resolveDynamic([false, false]);
  await expect(mixedRequest).resolves.toEqual([false, true]);
});

test("dynamic persistence remains opt-in", async () => {
  let saveCount = 0;
  const store: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": (): void => {
      saveCount++;
    },
  };
  const controller = new PermissionPromptController(store);
  const plugin = principal("a");
  const notRemembered = controller.requestDynamic(plugin, [LOGGING]);

  await waitForPrompt(controller);
  controller.resolveDynamic([true]);
  await expect(notRemembered).resolves.toEqual([true]);
  expect(saveCount).toBe(0);

  const promptedAgain = controller.requestDynamic(plugin, [LOGGING]);

  await waitForPrompt(controller);
  controller.resolveDynamic([false], true);
  await expect(promptedAgain).resolves.toEqual([false]);
  expect(saveCount).toBe(1);

  const remembered = controller.requestDynamic(plugin, [LOGGING]);

  await expect(remembered).resolves.toEqual([false]);
  expect(controller.currentPrompt).toBeUndefined();
});

test("static completion waits for its durable decision save", async () => {
  let finishSave: (() => void) | undefined;
  let saveStarted = false;
  const store: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": async () => {
      saveStarted = true;
      await new Promise<void>(resolve => {
        finishSave = resolve;
      });
    },
  };
  const controller = new PermissionPromptController(store);
  const request = controller.requestStatic(principal("a"), [BASIC_UI]);
  let completed = false;

  void request.then(() => {
    completed = true;

    return completed;
  });
  await waitForPrompt(controller);
  controller.resolveStatic(true);

  for (let attempt = 0; attempt < 5 && !saveStarted; attempt++) {
    await Promise.resolve();
  }

  expect(saveStarted).toBe(true);
  expect(completed).toBe(false);
  finishSave?.();
  await expect(request).resolves.toBe(true);
});

test("remembered dynamic completion waits for every durable decision save", async () => {
  let finishSave: (() => void) | undefined;
  let saveStarted = false;
  const store: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": async () => {
      saveStarted = true;
      await new Promise<void>(resolve => {
        finishSave = resolve;
      });
    },
  };
  const controller = new PermissionPromptController(store);
  const request = controller.requestDynamic(principal("a"), [LOGGING]);
  let completed = false;

  void request.then(() => {
    completed = true;

    return completed;
  });
  await waitForPrompt(controller);
  controller.resolveDynamic([true], true);

  for (let attempt = 0; attempt < 5 && !saveStarted; attempt++) {
    await Promise.resolve();
  }

  expect(saveStarted).toBe(true);
  expect(completed).toBe(false);
  finishSave?.();
  await expect(request).resolves.toEqual([true]);
});

test("a rejected remembered save is surfaced and never becomes session state", async () => {
  const store: PermissionDecisionStore = {
    "load": (): undefined => undefined,
    "save": async () => {
      throw new Error("permission decision disk is unavailable");
    },
  };
  const controller = new PermissionPromptController(store);
  const rejected = controller.requestDynamic(principal("a"), [LOGGING]);

  await waitForPrompt(controller);
  controller.resolveDynamic([true], true);
  await expect(rejected).rejects.toThrow("permission decision disk is unavailable");

  const retried = controller.requestDynamic(principal("a"), [LOGGING]);
  const retryPrompt = await waitForPrompt(controller);

  expect(retryPrompt.kind).toBe("dynamic");
  controller.resolveDynamic([false]);
  await expect(retried).resolves.toEqual([false]);
});

test("remembered decisions are isolated to the exact artifact", async () => {
  const store = (new InMemoryPermissionDecisionStore);
  const controller = new PermissionPromptController(store);
  const originalPrincipal = { ...principal("a") };
  const original = controller.requestDynamic(originalPrincipal, [BASIC_UI]);

  originalPrincipal.artifactSha256 = "c".repeat(64);

  const originalPrompt = await waitForPrompt(controller);

  expect(originalPrompt.principal.artifactSha256).toBe("a".repeat(64));
  controller.resolveDynamic([true], true);
  await expect(original).resolves.toEqual([true]);

  const updated = controller.requestDynamic(principal("b"), [BASIC_UI]);
  const prompt = await waitForPrompt(controller);

  expect(prompt.principal.artifactSha256).toBe("b".repeat(64));
  controller.resolveDynamic([false]);
  await expect(updated).resolves.toEqual([false]);
});

test("dynamic persistence includes the normalized request scope", async () => {
  const store = (new InMemoryPermissionDecisionStore);
  const controller = new PermissionPromptController(store);
  const plugin = principal("a");
  const original = controller.requestDynamic(plugin, [{
    "id"   : "network/http",
    "scope": {
      "origins": ["https://EXAMPLE.com:443/"],
      "methods": ["GET", "GET"],
    },
  }]);

  await waitForPrompt(controller);
  controller.resolveDynamic([true], true);
  await expect(original).resolves.toEqual([true]);

  const canonicalEquivalent = controller.requestDynamic(plugin, [{
    "id"   : "network/http",
    "scope": {
      "origins": ["https://example.com"],
      "methods": ["GET"],
    },
  }]);

  await expect(canonicalEquivalent).resolves.toEqual([true]);
  expect(controller.currentPrompt).toBeUndefined();

  const widerScope = controller.requestDynamic(plugin, [{
    "id"   : "network/http",
    "scope": {
      "origins": ["https://example.com"],
      "methods": ["GET", "POST"],
    },
  }]);
  const prompt = await waitForPrompt(controller);

  expect(prompt.kind).toBe("dynamic");

  if (prompt.kind !== "dynamic") {
    throw new Error("Expected a dynamic permission prompt");
  }

  expect(prompt.rememberedDecisions).toEqual([undefined]);
  controller.resolveDynamic([false]);
  await expect(widerScope).resolves.toEqual([false]);
});

test("duplicate dynamic fingerprints use one deterministic remembered decision", async () => {
  const persisted = (new Map<string, boolean>);
  let loadCount = 0;
  let saveCount = 0;
  const store: PermissionDecisionStore = {
    "load": key => {
      loadCount++;

      return persisted.get(JSON.stringify(key));
    },
    "save": (key, decision): void => {
      saveCount++;
      persisted.set(JSON.stringify(key), decision);
    },
  };
  const controller = new PermissionPromptController(store);
  const plugin = principal("a");
  const duplicateRequest = controller.requestDynamic(plugin, [BASIC_UI, BASIC_UI]);

  await waitForPrompt(controller);
  expect(() => controller.resolveDynamic([true, false], true)).toThrow(RangeError);
  expect(controller.currentPrompt).toBeDefined();
  controller.resolveDynamic([true, true], true);

  await expect(duplicateRequest).resolves.toEqual([true, true]);
  expect({ loadCount, saveCount }).toEqual({ "loadCount": 1, "saveCount": 1 });

  const freshController = new PermissionPromptController(store);
  const remembered = freshController.requestDynamic(plugin, [BASIC_UI, BASIC_UI]);

  await expect(remembered).resolves.toEqual([true, true]);
  expect(loadCount).toBe(2);
  expect(freshController.currentPrompt).toBeUndefined();
});

test("static persistence uses the full set and stays separate from dynamic", async () => {
  const store = (new InMemoryPermissionDecisionStore);
  const controller = new PermissionPromptController(store);
  const plugin = principal("a");
  const initial = controller.requestStatic(plugin, [BASIC_UI, SHELL, BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveStatic(true);
  await expect(initial).resolves.toBe(true);

  const reordered = controller.requestStatic(plugin, [SHELL, BASIC_UI]);

  await expect(reordered).resolves.toBe(true);
  expect(controller.currentPrompt).toBeUndefined();

  const changedArtifact = controller.requestStatic(
    principal("b"),
    [SHELL, BASIC_UI],
  );
  const changedPrompt = await waitForPrompt(controller);

  expect(changedPrompt.principal.artifactSha256).toBe("b".repeat(64));
  controller.resolveStatic(false);
  await expect(changedArtifact).resolves.toBe(false);

  const repeatedChangedArtifact = controller.requestStatic(
    principal("b"),
    [BASIC_UI, SHELL],
  );

  await expect(repeatedChangedArtifact).resolves.toBe(false);
  expect(controller.currentPrompt).toBeUndefined();

  const subset = controller.requestStatic(plugin, [BASIC_UI]);

  await waitForPrompt(controller);
  controller.resolveStatic(false);
  await expect(subset).resolves.toBe(false);

  const dynamic = controller.requestDynamic(plugin, [BASIC_UI, SHELL]);
  const dynamicPrompt = await waitForPrompt(controller);

  expect(dynamicPrompt.kind).toBe("dynamic");
  controller.resolveDynamic([true, false]);
  await expect(dynamic).resolves.toEqual([true, false]);
});

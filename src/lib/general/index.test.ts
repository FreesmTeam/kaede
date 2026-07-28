import { expect, test, vi } from "vitest";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import General from "@/lib/general";
import type { ConfigType } from "@/types/configs/config.type.ts";

const brokerMocks = vi.hoisted(() => ({
  "existsMany": vi.fn<(paths: ReadonlyArray<string>) => Promise<Array<boolean>>>(
    async paths => paths.map(() => true),
  ),
  "ensureDirectories": vi.fn<() => Promise<void>>(async () => {}),
  "showMainWebview"  : vi.fn<() => Promise<void>>(async () => {}),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "runtime": {
      "getCachedSnapshot": vi.fn<() => { "kind": "browser-preview" }>(
        () => ({ "kind": "browser-preview" }),
      ),
    },
    "files": {
      "existsMany"       : brokerMocks.existsMany,
      "ensureDirectories": brokerMocks.ensureDirectories,
    },
  },
  "DirectHost": { "showMainWebview": brokerMocks.showMainWebview },
}));

vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug": vi.fn<(...input: Array<unknown>) => void>(),
    "info" : vi.fn<(...input: Array<unknown>) => void>(),
  },
}));

test("public finalizeInitialization observes replacements on the mutable General API", async () => {
  const config = {
    "extensions": { "enabled": true },
    "misc"      : { "showAfterExtensionsInitialization": false },
    "minecraft" : { "javaBinary": "java" },
  } as ConfigType;
  const originalCachedJoin = General.cachedJoin;
  const originalGetJavaMajor = General.getJavaMajor;
  const originalJavaMajor = GlobalInternals.javaMajor;
  const replacementGetJavaMajor = vi.fn<() => Promise<number>>(async () => 23);

  Reflect.set(General, "cachedJoin", (...parts: Array<string>) => parts.join("::"));
  Reflect.set(General, "getJavaMajor", replacementGetJavaMajor);

  try {
    await General.finalizeInitialization({
      config,
      "baseDirectory": "plugin-root",
    });

    expect(brokerMocks.existsMany).toHaveBeenCalledWith(
      Object.values(FileStructure.Folders).map(({ Path }) => `plugin-root::${Path}`),
    );
    expect(GlobalInternals.javaMajor).toBe(23);
  } finally {
    Reflect.set(General, "cachedJoin", originalCachedJoin);
    Reflect.set(General, "getJavaMajor", originalGetJavaMajor);
    GlobalInternals.javaMajor = originalJavaMajor;
  }
});

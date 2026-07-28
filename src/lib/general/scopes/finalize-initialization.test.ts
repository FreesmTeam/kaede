import { beforeEach, expect, test, vi } from "vitest";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import type {
  HostFacade,
  InitializationFinalizationReport,
  RuntimeSnapshot,
} from "@/lib/capability-broker";
import { finalizeInitialization } from "@/lib/general/scopes/finalize-initialization.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

const brokerMocks = vi.hoisted(() => ({
  "getCachedSnapshot"     : vi.fn<HostFacade["runtime"]["getCachedSnapshot"]>(),
  "finalizeInitialization": vi.fn<HostFacade["runtime"]["finalizeInitialization"]>(),
  "existsMany"            : vi.fn<HostFacade["files"]["existsMany"]>(),
  "ensureDirectories"     : vi.fn<HostFacade["files"]["ensureDirectories"]>(),
  "showMainWebview"       : vi.fn(async (): Promise<void> => {}),
  "cachedJoin"            : vi.fn((...parts: ReadonlyArray<string>) => parts.join("/")),
  "getJavaMajor"          : vi.fn(async (): Promise<number> => 8),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "runtime": {
      "getCachedSnapshot"     : brokerMocks.getCachedSnapshot,
      "finalizeInitialization": brokerMocks.finalizeInitialization,
    },
    "files": {
      "existsMany"       : brokerMocks.existsMany,
      "ensureDirectories": brokerMocks.ensureDirectories,
    },
  },
  "DirectHost": { "showMainWebview": brokerMocks.showMainWebview },
}));

vi.mock("@/lib/general", () => ({
  "default": {
    "cachedJoin"  : brokerMocks.cachedJoin,
    "getJavaMajor": brokerMocks.getJavaMajor,
  },
}));

const desktopSnapshot: RuntimeSnapshot = {
  "kind"               : "desktop",
  "launchCount"        : 3,
  "portable"           : false,
  "baseDirectory"      : "/app/data",
  "executableDirectory": "/app/bin",
  "appDataDirectory"   : "/app/data",
  "os"                 : { "platform": "linux", "arch": "x86_64", "version": "test" },
};
const browserSnapshot: RuntimeSnapshot = {
  ...desktopSnapshot,
  "kind"               : "browser-preview",
  "launchCount"        : 1,
  "baseDirectory"      : "indexed_db",
  "executableDirectory": "indexed_db",
  "appDataDirectory"   : "indexed_db",
};

function config(shouldShowAfterExtensionsInitialization = false): ConfigType {
  return {
    "extensions": { "enabled": true },
    "misc"      : { "showAfterExtensionsInitialization": shouldShowAfterExtensionsInitialization },
    "minecraft" : { "javaBinary": "/opt/java/bin/java" },
  } as ConfigType;
}

beforeEach(() => {
  vi.clearAllMocks();
  brokerMocks.getCachedSnapshot.mockReturnValue(desktopSnapshot);
  GlobalInternals.javaMajor = undefined;
});

test("desktop finalization uses the typed host broker report", async () => {
  const report: InitializationFinalizationReport = {
    "createdDirectories": ["/app/data/assets"],
    "javaMajor"         : 21,
    "javaMajorSource"   : "release-file",
  };

  brokerMocks.finalizeInitialization.mockResolvedValue(report);

  await finalizeInitialization({
    "config"       : config(),
    "baseDirectory": "/app/data",
  });

  expect(brokerMocks.finalizeInitialization).toHaveBeenCalledWith({
    "baseDirectory": "/app/data",
    "folders"      : Object.values(FileStructure.Folders).map(({ Path }) => Path),
    "javaBinary"   : "/opt/java/bin/java",
  });
  expect(GlobalInternals.javaMajor).toBe(21);
  expect(brokerMocks.existsMany).not.toHaveBeenCalled();
  expect(brokerMocks.getJavaMajor).not.toHaveBeenCalled();
  expect(brokerMocks.showMainWebview).toHaveBeenCalledOnce();
});

test("browser finalization keeps the filesystem and Java fallbacks", async () => {
  const folders = Object.values(FileStructure.Folders);
  const statuses = folders.map((_folder, index) => index !== 0);

  brokerMocks.getCachedSnapshot.mockReturnValue(browserSnapshot);
  brokerMocks.existsMany.mockResolvedValue(statuses);

  await finalizeInitialization({
    "config"       : config(),
    "baseDirectory": "indexed_db",
  });

  expect(brokerMocks.finalizeInitialization).not.toHaveBeenCalled();
  expect(brokerMocks.existsMany).toHaveBeenCalledWith(
    folders.map(({ Path }) => `indexed_db/${Path}`),
  );
  expect(brokerMocks.ensureDirectories).toHaveBeenCalledWith([
    `indexed_db/${folders[0]?.Path}`,
  ]);
  expect(brokerMocks.getJavaMajor).toHaveBeenCalledOnce();
  expect(GlobalInternals.javaMajor).toBe(8);
  expect(brokerMocks.showMainWebview).toHaveBeenCalledOnce();
});

import { beforeEach, expect, test, vi } from "vitest";

import { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const mocks = vi.hoisted(() => ({
  "getNecessaries"             : vi.fn(),
  "unzipNatives"               : vi.fn<() => Promise<void>>(),
  "downloadAssets"             : vi.fn<() => Promise<boolean>>(),
  "downloadClient"             : vi.fn<() => Promise<boolean>>(),
  "downloadLogging"            : vi.fn<() => Promise<boolean>>(),
  "downloadLibraries"          : vi.fn<() => Promise<boolean>>(),
  "resolvePatch"               : vi.fn(),
  "resolveSubPatches"          : vi.fn(),
  "finalizePatches"            : vi.fn(),
  "ensurePatchDirectories"     : vi.fn<() => Promise<void>>(),
  "ensureMinecraftDirectory"   : vi.fn<() => Promise<void>>(),
  "initializeAssetsDirectories": vi.fn<() => Promise<void>>(),
  "createCommand"              : vi.fn(),
  "spawnMinecraft"             : vi.fn(),
}));

vi.mock("@/lib/launcher", () => ({
  "default": {
    "createCommand" : mocks.createCommand,
    "spawnMinecraft": mocks.spawnMinecraft,
  },
}));
vi.mock("@/lib/launcher/scopes/extractors", () => ({
  "default": {
    "getNecessaries": mocks.getNecessaries,
    "unzipNatives"  : mocks.unzipNatives,
  },
}));
vi.mock("@/lib/launcher/scopes/fetching", () => ({
  "default": {
    "downloadAssets"   : mocks.downloadAssets,
    "downloadClient"   : mocks.downloadClient,
    "downloadLogging"  : mocks.downloadLogging,
    "downloadLibraries": mocks.downloadLibraries,
  },
}));
vi.mock("@/lib/launcher/scopes/parsers", () => ({
  "default": { "finalizePatches": mocks.finalizePatches },
}));
vi.mock("@/lib/launcher/scopes/patches", () => ({
  "default": {
    "resolvePatch"     : mocks.resolvePatch,
    "resolveSubPatches": mocks.resolveSubPatches,
  },
}));
vi.mock("@/lib/launcher/scopes/validators", () => ({
  "default": {
    "ensurePatchDirectories"     : mocks.ensurePatchDirectories,
    "ensureMinecraftDirectory"   : mocks.ensureMinecraftDirectory,
    "initializeAssetsDirectories": mocks.initializeAssetsDirectories,
  },
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "info"     : vi.fn(),
    "warn"     : vi.fn(),
    "templates": { "json": { "contents": vi.fn((label: string) => label) } },
  },
}));

const instance: InstanceStateType = {
  "name"         : "Test",
  "checksum"     : true,
  "playTime"     : 0,
  "lastLaunch"   : 0,
  "entry"        : "net.minecraft",
  "pinned"       : false,
  "groups"       : [],
  "patchVersions": { "net.minecraft": "1.21.5" },
  "windowHeight" : 480,
  "windowWidth"  : 854,
  "icon"         : "",
  "javaBinary"   : "java",
  "add"          : {},
  "remove"       : {},
};
const statuses: LauncherStatusesType = {
  "launching": 1,
  "current"  : undefined,
  "downloads": {
    "current"    : new Map,
    "success"    : 0,
    "failed"     : 0,
    "total"      : 0,
    "cancellable": false,
  },
};
const necessaries: PreLaunchInformationType = {
  "logPrefix": "test",
  statuses,
  "platform" : "linux",
  "arch"     : "x64",
  instance,
  "cancelId" : "test-download",
  "user"     : {
    "javaBinary": "java",
    "javaMajor" : 21,
    "versions"  : instance.patchVersions,
  },
  "directories": {
    "base"        : "/base",
    "instance"    : "/instance",
    "assets"      : "/assets",
    "logging"     : "/logging",
    "libraries"   : "/libraries",
    "natives"     : "/natives",
    "assetIndexes": "/assets/indexes",
    "assetObjects": "/assets/objects",
  },
};
const entryPatch: SpecificPatchMetaType = {
  "formatVersion": 1,
  "name"         : "Minecraft",
  "uid"          : "net.minecraft",
  "version"      : "1.21.5",
};
const finalizedPatch: FinalizedPatchType = {
  "+jvmArgs" : [],
  "+traits"  : [],
  "+tweakers": [],
  "artifacts": [{
    "id"       : "native",
    "path"     : "/libraries/native.jar",
    "file"     : "native.jar",
    "directory": "/libraries",
    "url"      : "https://example.test/native.jar",
    "hash"     : "sha1",
    "status"   : "native",
  }],
  "mainClass"         : "net.minecraft.client.main.Main",
  "minecraftArguments": "",
  "assetIndex"        : undefined,
  "type"              : undefined,
  "client"            : false,
  "logging"           : false,
};

function deferred(): Readonly<{
  "promise": Promise<boolean>;
  "resolve": (value: boolean) => void;
}> {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>(promiseResolve => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNecessaries.mockReturnValue(necessaries);
  mocks.ensurePatchDirectories.mockResolvedValue();
  mocks.ensureMinecraftDirectory.mockResolvedValue();
  mocks.initializeAssetsDirectories.mockResolvedValue();
  mocks.resolvePatch.mockResolvedValue(entryPatch);
  mocks.resolveSubPatches.mockResolvedValue([entryPatch]);
  mocks.finalizePatches.mockReturnValue(finalizedPatch);
  mocks.unzipNatives.mockResolvedValue();
  mocks.createCommand.mockResolvedValue({ "java": "java", "arguments": [] });
  mocks.spawnMinecraft.mockResolvedValue({ "success": true, "process": undefined });
});

test("extracts natives early and launches after every download completes", async () => {
  const assets = deferred();
  const client = deferred();
  const logging = deferred();

  mocks.downloadAssets.mockReturnValue(assets.promise);
  mocks.downloadClient.mockReturnValue(client.promise);
  mocks.downloadLogging.mockReturnValue(logging.promise);
  mocks.downloadLibraries.mockResolvedValue(true);

  const launchTask = handleLaunch({
    "instanceId"     : "test",
    instance,
    statuses,
    "userPreferences": necessaries.user,
    "onClose"        : vi.fn(),
    "onInput"        : vi.fn(),
  });

  await vi.waitFor(() => expect(mocks.unzipNatives).toHaveBeenCalledOnce());
  expect(mocks.createCommand).not.toHaveBeenCalled();

  assets.resolve(true);
  client.resolve(true);
  logging.resolve(true);

  await expect(launchTask).resolves.toEqual({ "success": true, "process": undefined });
  expect(mocks.createCommand).toHaveBeenCalledOnce();
  expect(mocks.spawnMinecraft).toHaveBeenCalledOnce();
});

test("does not create or spawn a command after a cancelled download step", async () => {
  mocks.downloadAssets.mockResolvedValue(true);
  mocks.downloadClient.mockResolvedValue(false);
  mocks.downloadLogging.mockResolvedValue(true);
  mocks.downloadLibraries.mockResolvedValue(true);

  await expect(handleLaunch({
    "instanceId"     : "test",
    instance,
    statuses,
    "userPreferences": necessaries.user,
    "onClose"        : vi.fn(),
    "onInput"        : vi.fn(),
  })).resolves.toEqual({ "success": false, "process": undefined });
  expect(mocks.createCommand).not.toHaveBeenCalled();
  expect(mocks.spawnMinecraft).not.toHaveBeenCalled();
});

import { expect, test, vi } from "vitest";

import Launcher from "@/lib/launcher";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "info"     : vi.fn<(...input: Array<unknown>) => void>(),
    "warn"     : vi.fn<(...input: Array<unknown>) => void>(),
    "templates": {
      "json": { "contents": vi.fn<(label: string) => string>(label => label) },
    },
  },
}));

test("public handleLaunch observes replacements on the mutable Launcher API", async () => {
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
  const patch: SpecificPatchMetaType = {
    "formatVersion": 1,
    "name"         : "Minecraft",
    "uid"          : "net.minecraft",
    "version"      : "1.21.5",
  };
  const finalized: FinalizedPatchType = {
    "+jvmArgs"          : [],
    "+traits"           : [],
    "+tweakers"         : [],
    "artifacts"         : [],
    "mainClass"         : "net.minecraft.client.main.Main",
    "minecraftArguments": "",
    "assetIndex"        : undefined,
    "type"              : undefined,
    "client"            : false,
    "logging"           : false,
  };
  const replacementCreateCommand = vi.fn<typeof Launcher.createCommand>(async () => ({
    "java"     : "plugin-java",
    "arguments": ["plugin-argument"],
  }));
  let observedCommand: Readonly<{ "java": string; "arguments": Array<string> }> | undefined;
  const replacementSpawnMinecraft: typeof Launcher.spawnMinecraft = async ({ command }) => {
    observedCommand = command;

    return { "success": true, "process": undefined };
  };
  const restorations: Array<() => void> = [];
  const replace = (target: object, key: PropertyKey, value: unknown): void => {
    const original = Reflect.get(target, key);

    restorations.push(() => {
      Reflect.set(target, key, original);
    });
    Reflect.set(target, key, value);
  };

  replace(Launcher.Extractors, "getNecessaries", () => necessaries);
  replace(Launcher.Extractors, "unzipNatives", async () => {});
  replace(Launcher.Validators, "ensurePatchDirectories", async () => {});
  replace(Launcher.Validators, "ensureMinecraftDirectory", async () => {});
  replace(Launcher.Validators, "initializeAssetsDirectories", async () => {});
  replace(Launcher.Patches, "resolvePatch", async () => patch);
  replace(Launcher.Patches, "resolveSubPatches", async () => [patch]);
  replace(Launcher.Parsers, "finalizePatches", () => finalized);
  replace(Launcher.Fetching, "downloadAssets", async () => true);
  replace(Launcher.Fetching, "downloadClient", async () => true);
  replace(Launcher.Fetching, "downloadLogging", async () => true);
  replace(Launcher.Fetching, "downloadLibraries", async () => true);
  replace(Launcher, "createCommand", replacementCreateCommand);
  replace(Launcher, "spawnMinecraft", replacementSpawnMinecraft);

  try {
    await expect(Launcher.handleLaunch({
      "instanceId"     : "test",
      instance,
      statuses,
      "userPreferences": necessaries.user,
      "onClose"        : vi.fn<(instanceId: string) => void>(),
      "onInput"        : vi.fn<(line: string) => void>(),
    })).resolves.toEqual({ "success": true, "process": undefined });
    expect(observedCommand).toEqual({
      "java"     : "plugin-java",
      "arguments": ["plugin-argument"],
    });
  } finally {
    for (const restore of restorations.toReversed()) {
      restore();
    }
  }
});

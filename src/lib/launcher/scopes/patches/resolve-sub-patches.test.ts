import { beforeEach, expect, test, vi } from "vitest";

import { Patches } from "@/constants/meta.ts";
import { resolveSubPatches } from "@/lib/launcher/scopes/patches/resolve-sub-patches.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

const mocks = vi.hoisted(() => ({
  "resolvePatch": vi.fn<(
    input: Readonly<{
      "necessaries": PreLaunchInformationType;
      "metadata"   : PatchDependencyType;
    }>,
  ) => Promise<SpecificPatchMetaType | false>>(),
}));

vi.mock("@/lib/launcher/scopes/patches/resolve-patch.ts", () => ({
  "resolvePatch": mocks.resolvePatch,
}));

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
  "instance" : {
    "name"         : "Test",
    "checksum"     : true,
    "playTime"     : 0,
    "lastLaunch"   : 0,
    "entry"        : Patches.Minecraft,
    "pinned"       : false,
    "groups"       : [],
    "patchVersions": { [Patches.Minecraft]: "1.21.5" },
    "windowHeight" : 480,
    "windowWidth"  : 854,
    "icon"         : "",
    "javaBinary"   : "java",
    "add"          : {},
    "remove"       : {},
  },
  "cancelId": "test-download",
  "user"    : {
    "javaBinary": "java",
    "javaMajor" : 21,
    "versions"  : { [Patches.Minecraft]: "1.21.5" },
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

function patch(
  uid: SpecificPatchMetaType["uid"],
  requires?: Array<PatchDependencyType>,
): SpecificPatchMetaType {
  return {
    "formatVersion": 1,
    "name"         : uid,
    uid,
    "version"      : "test",
    ...(requires && { requires }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("resolves nested dependency groups and skips failed patches", async () => {
  const intermediaryDependency: PatchDependencyType = {
    "uid": Patches.FabricIntermediary,
  };
  const loaderDependency: PatchDependencyType = {
    "uid": Patches.FabricLoader,
  };
  const failedDependency: PatchDependencyType = {
    "uid": Patches.MinecraftForge,
  };
  const minecraftPatch = patch(Patches.Minecraft, [loaderDependency, failedDependency]);
  const loaderPatch = patch(Patches.FabricLoader, [intermediaryDependency]);
  const intermediaryPatch = patch(Patches.FabricIntermediary);

  mocks.resolvePatch.mockImplementation(({ metadata }) => {
    if (metadata.uid === Patches.FabricLoader) {
      return Promise.resolve(loaderPatch);
    }

    if (metadata.uid === Patches.FabricIntermediary) {
      return Promise.resolve(intermediaryPatch);
    }

    return Promise.resolve(false);
  });

  await expect(resolveSubPatches({ necessaries, "patchMeta": minecraftPatch }))
    .resolves.toEqual([minecraftPatch, loaderPatch, intermediaryPatch]);
  expect(mocks.resolvePatch).toHaveBeenCalledTimes(3);
  expect(mocks.resolvePatch).toHaveBeenNthCalledWith(1, {
    necessaries,
    "metadata": loaderDependency,
  });
  expect(mocks.resolvePatch).toHaveBeenNthCalledWith(2, {
    necessaries,
    "metadata": failedDependency,
  });
  expect(mocks.resolvePatch).toHaveBeenNthCalledWith(3, {
    necessaries,
    "metadata": intermediaryDependency,
  });
});

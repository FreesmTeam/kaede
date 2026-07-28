import { beforeEach, expect, test, vi } from "vitest";

import { downloadClient } from "@/lib/launcher/scopes/fetching/download-client.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const mocks = vi.hoisted(() => ({
  "ensureDirectories"      : vi.fn<() => Promise<void>>(),
  "concurrentlyDownload"   : vi.fn(),
  "verifyArtifacts"        : vi.fn<() => Promise<Array<string>>>(),
  "catchAsyncResponseHooks": vi.fn<() => Promise<"continue">>(),
  "catchAsyncVoidHooks"    : vi.fn<() => Promise<void>>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": { "files": { "ensureDirectories": mocks.ensureDirectories } },
}));
vi.mock("@/lib/errors", () => ({
  "default": { "prettify": String },
}));
vi.mock("@/lib/extensions-manager", () => ({
  "default": {
    "catchAsyncResponseHooks": mocks.catchAsyncResponseHooks,
    "catchAsyncVoidHooks"    : mocks.catchAsyncVoidHooks,
  },
}));
vi.mock("@/lib/general", () => ({
  "default": { "concurrentlyDownload": mocks.concurrentlyDownload },
}));
vi.mock("@/lib/launcher/scopes/validators/verify-artifacts.ts", () => ({
  "verifyArtifacts": mocks.verifyArtifacts,
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug": vi.fn(),
    "info" : vi.fn(),
    "warn" : vi.fn(),
    "error": vi.fn(),
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
const finalizedPatch: FinalizedPatchType = {
  "+jvmArgs"          : [],
  "+traits"           : [],
  "+tweakers"         : [],
  "artifacts"         : [],
  "mainClass"         : "net.minecraft.client.main.Main",
  "minecraftArguments": "",
  "assetIndex"        : undefined,
  "type"              : undefined,
  "logging"           : false,
  "client"            : {
    "id"       : "client",
    "path"     : "/instance/client.jar",
    "file"     : "client.jar",
    "directory": "/instance",
    "url"      : "https://example.test/client.jar",
    "hash"     : "sha1",
  },
};

function statuses(): LauncherStatusesType {
  return {
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
}

function necessaries(currentStatuses: LauncherStatusesType): PreLaunchInformationType {
  return {
    "logPrefix": "test",
    "statuses" : currentStatuses,
    "platform" : "linux",
    "arch"     : "x64",
    instance,
    "cancelId" : "instance-download",
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
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensureDirectories.mockResolvedValue();
  mocks.verifyArtifacts.mockResolvedValue(["/instance/client.jar"]);
  mocks.catchAsyncResponseHooks.mockResolvedValue("continue");
  mocks.catchAsyncVoidHooks.mockResolvedValue();
});

test("stops the launch and success hooks when the required client download fails", async () => {
  const currentStatuses = statuses();

  mocks.concurrentlyDownload.mockResolvedValue({
    "success"  : 0,
    "failed"   : 1,
    "cancelled": false,
    "failures" : [{
      "url"  : "https://example.test/client.jar",
      "path" : "/instance/client.jar",
      "error": "HTTP 500",
    }],
  });

  await expect(downloadClient({
    "necessaries": necessaries(currentStatuses),
    finalizedPatch,
  })).resolves.toBe(false);
  expect(mocks.concurrentlyDownload).toHaveBeenCalledWith(expect.objectContaining({
    "cancelId": "instance-download",
  }));
  expect(mocks.catchAsyncVoidHooks).not.toHaveBeenCalled();
});

test("does not double count a broker transport error", async () => {
  const currentStatuses = statuses();

  mocks.concurrentlyDownload.mockRejectedValue(
    new Error("broker disconnected"),
  );

  await expect(downloadClient({
    "necessaries": necessaries(currentStatuses),
    finalizedPatch,
  })).resolves.toBe(false);
  expect(currentStatuses.downloads.failed).toBe(0);
  expect(mocks.catchAsyncVoidHooks).not.toHaveBeenCalled();
});

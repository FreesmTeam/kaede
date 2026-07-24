import { beforeEach, expect, test, vi } from "vitest";

import {
  extractPreLaunchInformation,
} from "@/lib/launcher/scopes/extractors/extract-pre-launch-information.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

const extensionMocks = vi.hoisted(() => ({
  "catchSyncResponseHooks": vi.fn(() => "continue"),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "runtime": {
      "getCachedSnapshot": (): { "os": {
        "platform": string;
        "arch"    : string;
        "version" : string;
      }; } => ({
        "os": { "platform": "linux", "arch": "x86_64", "version": "1" },
      }),
    },
  },
}));
vi.mock("@/lib/extensions-manager", () => ({ "default": extensionMocks }));
vi.mock("@/lib/general", () => ({
  "default": {
    "getCachedBaseDirectory": (): string => "/base",
    "cachedJoin"            : (...parts: ReadonlyArray<string>): string => parts.join("/"),
  },
}));
vi.mock("@/lib/instances", () => ({
  "default": {
    "getMinecraftDirectory": ({ instanceId }: { "instanceId": string }): string => {
      return `/base/instances/${instanceId}/.minecraft`;
    },
  },
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": { "error": vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  extensionMocks.catchSyncResponseHooks.mockReturnValue("continue");
});

test("uses the cached broker OS snapshot and scopes cancellation to the instance", () => {
  const result = extractPreLaunchInformation({
    "statuses"       : statuses(),
    instance,
    "instanceId"     : "instance-42",
    "userPreferences": {
      "javaBinary": "java",
      "javaMajor" : 21,
      "versions"  : instance.patchVersions,
    },
    "logPrefix": "instance-42",
  });

  expect(result).toMatchObject({
    "platform": "linux",
    "arch"    : "x64",
    "cancelId": "instance-42-download",
  });
});

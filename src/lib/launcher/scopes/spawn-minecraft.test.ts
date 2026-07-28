import { beforeEach, expect, test, vi } from "vitest";

import { LaunchStatus } from "@/constants/launcher.ts";
import type {
  BrokerProcess,
  HostFacade,
  ProcessEvent,
  ProcessHandle,
} from "@/lib/capability-broker";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const brokerMocks = vi.hoisted(() => ({
  "launchMinecraft": vi.fn<HostFacade["processes"]["launchMinecraft"]>(),
}));
const extensionMocks = vi.hoisted(() => ({
  "catchAsyncResponseHooks": vi.fn<() => Promise<"continue">>(),
  "catchAsyncVoidHooks"    : vi.fn<(
    input: Readonly<{ "scope": string }>,
  ) => Promise<void>>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "processes": {
      "launchMinecraft": brokerMocks.launchMinecraft,
    },
  },
}));
vi.mock("@/lib/extensions-manager", () => ({
  "default": extensionMocks,
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug"    : vi.fn(),
    "info"     : vi.fn(),
    "warn"     : vi.fn(),
    "error"    : vi.fn(),
    "templates": {
      "json": {
        "contents": vi.fn((label: string) => label),
      },
    },
  },
}));

const process = Object.freeze({
  "handle": "minecraft-handle" as ProcessHandle,
  "pid"   : 37,
}) satisfies BrokerProcess;

function launchStatuses(): LauncherStatusesType {
  return {
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current"    : new Map<string, [number, number]>,
      "success"    : 0,
      "failed"     : 0,
      "total"      : 0,
      "cancellable": false,
    },
  };
}

function preLaunchInformation(statuses: LauncherStatusesType): PreLaunchInformationType {
  return {
    "logPrefix": "test-launch",
    statuses,
    "platform" : "linux",
    "arch"     : "x64",
    "instance" : {
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
    },
    "user": {
      "javaBinary": "java",
      "javaMajor" : 21,
      "versions"  : { "net.minecraft": "1.21.5" },
    },
    "directories": {
      "base"        : "/test",
      "instance"    : "/test/instance",
      "assets"      : "/test/assets",
      "logging"     : "/test/logging",
      "libraries"   : "/test/libraries",
      "natives"     : "/test/natives",
      "assetIndexes": "/test/assets/indexes",
      "assetObjects": "/test/assets/objects",
    },
    "cancelId": "test-instance-download",
  };
}

function outputEvent(
  kind: "stdout" | "stderr",
  bytes: Uint8Array,
): ProcessEvent {
  return Object.freeze({ kind, "handle": process.handle, bytes });
}

function terminatedEvent(): ProcessEvent {
  return Object.freeze({
    "kind"  : "terminated",
    "handle": process.handle,
    "code"  : 0,
    "signal": null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  extensionMocks.catchAsyncResponseHooks.mockResolvedValue("continue");
  extensionMocks.catchAsyncVoidHooks.mockResolvedValue();
});

test("does not return a process that terminates before launch resolves", async () => {
  const statuses = launchStatuses();
  const onClose = vi.fn();
  const onInput = vi.fn();
  const encoder = new TextEncoder;
  const stdout = encoder.encode("🙂");
  const stderr = encoder.encode("€");

  brokerMocks.launchMinecraft.mockImplementation(async (_input, onEvent) => {
    onEvent(outputEvent("stdout", stdout.subarray(0, 2)));
    onEvent(outputEvent("stderr", stderr.subarray(0, 1)));
    onEvent(outputEvent("stdout", stdout.subarray(2)));
    onEvent(outputEvent("stderr", stderr.subarray(1)));
    onEvent(outputEvent("stdout", Uint8Array.of(0xE2)));
    onEvent(outputEvent("stderr", Uint8Array.of(0xF0)));
    onEvent(terminatedEvent());

    return process;
  });

  const result = await spawnMinecraft({
    "command"    : { "java": "java", "arguments": [] },
    "instanceId" : "test-instance",
    "necessaries": preLaunchInformation(statuses),
    onClose,
    onInput,
  });

  expect(result).toEqual({ "success": false, "process": undefined });
  expect(statuses.current).toBe(LaunchStatus.General.Aborted);
  expect(onClose).toHaveBeenCalledOnce();
  expect(onInput.mock.calls.map(call => call[0])).toEqual(["🙂", "€", "�", "�"]);
  expect(extensionMocks.catchAsyncVoidHooks).not.toHaveBeenCalledWith(
    expect.objectContaining({ "scope": "onMinecraftLaunch" }),
  );
});

test("preserves an early terminal process failure as a failed launch", async () => {
  const statuses = launchStatuses();
  const onClose = vi.fn();

  brokerMocks.launchMinecraft.mockImplementation(async (_input, onEvent) => {
    onEvent(Object.freeze({
      "kind"   : "failed",
      "handle" : process.handle,
      "message": "spawn failed",
    }));

    return process;
  });

  const result = await spawnMinecraft({
    "command"    : { "java": "java", "arguments": [] },
    "instanceId" : "test-instance",
    "necessaries": preLaunchInformation(statuses),
    onClose,
    "onInput"    : vi.fn(),
  });

  expect(result).toEqual({ "success": false, "process": undefined });
  expect(statuses.current).toBe(LaunchStatus.Errors.UnhandledError);
  expect(onClose).toHaveBeenCalledOnce();
  expect(extensionMocks.catchAsyncVoidHooks).not.toHaveBeenCalledWith(
    expect.objectContaining({ "scope": "onMinecraftLaunch" }),
  );
});

test("keeps a launched process active after an error until termination", async () => {
  const statuses = launchStatuses();
  const onClose = vi.fn();
  let onProcessEvent: ((event: ProcessEvent) => void) | undefined;

  brokerMocks.launchMinecraft.mockImplementation(async (_input, onEvent) => {
    onProcessEvent = onEvent;

    return process;
  });

  const result = await spawnMinecraft({
    "command"    : { "java": "java", "arguments": [] },
    "instanceId" : "test-instance",
    "necessaries": preLaunchInformation(statuses),
    onClose,
    "onInput"    : vi.fn(),
  });

  onProcessEvent?.(Object.freeze({
    "kind"   : "error",
    "handle" : process.handle,
    "message": "diagnostic only",
  }));
  expect(result).toEqual({ "success": true, process });
  expect(onClose).not.toHaveBeenCalled();

  onProcessEvent?.(terminatedEvent());
  expect(onClose).toHaveBeenCalledOnce();
});

test("does not report success when the process terminates during the launch hook", async () => {
  const statuses = launchStatuses();
  let onProcessEvent: ((event: ProcessEvent) => void) | undefined;

  brokerMocks.launchMinecraft.mockImplementation(async (_input, onEvent) => {
    onProcessEvent = onEvent;

    return process;
  });
  extensionMocks.catchAsyncVoidHooks.mockImplementation(async input => {
    if (input.scope === "onMinecraftLaunch") {
      onProcessEvent?.(terminatedEvent());
    }
  });

  const result = await spawnMinecraft({
    "command"    : { "java": "java", "arguments": [] },
    "instanceId" : "test-instance",
    "necessaries": preLaunchInformation(statuses),
    "onClose"    : vi.fn(),
    "onInput"    : vi.fn(),
  });

  expect(result).toEqual({ "success": false, "process": undefined });
  expect(statuses.current).toBe(LaunchStatus.General.Aborted);
});

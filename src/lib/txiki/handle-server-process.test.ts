import { afterEach, expect, test, vi } from "vitest";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import type {
  BrokerServerProcess,
  ProcessEvent,
  ProcessHandle,
} from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
import {
  handleServerProcess,
} from "@/lib/txiki/handle-server-process.ts";
import { serverProcesses } from "@/states/servers.ts";

function serverProcess(
  handle = "server-handle" as ProcessHandle,
): BrokerServerProcess {
  return Object.freeze({
    handle,
    "pid" : 41,
    "port": 4123,
  });
}

afterEach(() => {
  GlobalInternals.serverProcesses = [];
  serverProcesses.value = [];
});

test("does not register a server that terminates before start resolves", async () => {
  const process = serverProcess();

  const returnedProcess = await handleServerProcess("fast-exit", async onEvent => {
    onEvent(Object.freeze({
      "kind"  : "terminated",
      "handle": process.handle,
      "code"  : 1,
      "signal": null,
    }));

    return process;
  });

  expect(GlobalInternals.serverProcesses).toEqual([]);
  expect(serverProcesses.value).toEqual([]);
  expect(returnedProcess).toBeUndefined();
});

test("returns and stores the same opaque broker process", async () => {
  const process = serverProcess();

  const returnedProcess = await handleServerProcess("identity", async () => process);

  expect(returnedProcess).toBe(process);
  expect(GlobalInternals.serverProcesses[0]?.value).toBe(process);
  expect(serverProcesses.value[0]?.value).toBe(process);
});

test("removes a registered server when it later terminates", async () => {
  const process = serverProcess();
  let onProcessEvent: ((event: ProcessEvent) => void) | undefined;

  await handleServerProcess("running", async onEvent => {
    onProcessEvent = onEvent;

    return process;
  });

  expect(GlobalInternals.serverProcesses).toHaveLength(1);
  onProcessEvent?.(Object.freeze({
    "kind"  : "terminated",
    "handle": process.handle,
    "code"  : 0,
    "signal": null,
  }));
  expect(GlobalInternals.serverProcesses).toEqual([]);
  expect(serverProcesses.value).toEqual([]);
});

test("removes only the terminal handle when server names are duplicated", async () => {
  const firstProcess = serverProcess("first-handle" as ProcessHandle);
  const secondProcess = serverProcess("second-handle" as ProcessHandle);
  let onFirstEvent: ((event: ProcessEvent) => void) | undefined;

  await handleServerProcess("duplicate", async onEvent => {
    onFirstEvent = onEvent;

    return firstProcess;
  });
  await handleServerProcess("duplicate", async () => secondProcess);

  onFirstEvent?.(Object.freeze({
    "kind"  : "terminated",
    "handle": firstProcess.handle,
    "code"  : 0,
    "signal": null,
  }));

  expect(GlobalInternals.serverProcesses).toEqual([{
    "name" : "duplicate",
    "port" : secondProcess.port,
    "value": secondProcess,
  }]);
  expect(serverProcesses.value).toEqual(GlobalInternals.serverProcesses);
});

test("keeps a registered server after an error until a terminal event", async () => {
  const process = serverProcess();
  let onProcessEvent: ((event: ProcessEvent) => void) | undefined;

  await handleServerProcess("diagnostic", async onEvent => {
    onProcessEvent = onEvent;

    return process;
  });

  onProcessEvent?.(Object.freeze({
    "kind"   : "error",
    "handle" : process.handle,
    "message": "diagnostic only",
  }));
  expect(GlobalInternals.serverProcesses).toHaveLength(1);
  expect(serverProcesses.value).toHaveLength(1);

  onProcessEvent?.(Object.freeze({
    "kind"  : "terminated",
    "handle": process.handle,
    "code"  : 0,
    "signal": null,
  }));
  expect(GlobalInternals.serverProcesses).toEqual([]);
  expect(serverProcesses.value).toEqual([]);
});

test("removes a retained server after terminal cleanup failure is reported", async () => {
  const process = serverProcess();
  let onProcessEvent: ((event: ProcessEvent) => void) | undefined;

  await handleServerProcess("cleanup-retry", async onEvent => {
    onProcessEvent = onEvent;

    return process;
  });

  onProcessEvent?.(Object.freeze({
    "kind"   : "error",
    "handle" : process.handle,
    "message": "automatic cleanup failed; retained for retry",
  }));
  expect(GlobalInternals.serverProcesses).toHaveLength(1);

  onProcessEvent?.(Object.freeze({
    "kind"   : "failed",
    "handle" : process.handle,
    "message": "cleanup retry confirmed termination",
  }));
  expect(GlobalInternals.serverProcesses).toEqual([]);
  expect(serverProcesses.value).toEqual([]);
});

test("decodes and flushes interleaved stdout and stderr independently", async () => {
  const process = serverProcess();
  const debugSpy = vi.spyOn(log, "debug");
  const errorSpy = vi.spyOn(log, "error");
  const encoder = new TextEncoder;
  const stdout = encoder.encode("🙂");
  const stderr = encoder.encode("€");

  await handleServerProcess("streaming", async onEvent => {
    onEvent(Object.freeze({
      "kind": "stdout", "handle": process.handle, "bytes": stdout.subarray(0, 2),
    }));
    onEvent(Object.freeze({
      "kind": "stderr", "handle": process.handle, "bytes": stderr.subarray(0, 1),
    }));
    onEvent(Object.freeze({
      "kind": "stdout", "handle": process.handle, "bytes": stdout.subarray(2),
    }));
    onEvent(Object.freeze({
      "kind": "stderr", "handle": process.handle, "bytes": stderr.subarray(1),
    }));
    onEvent(Object.freeze({
      "kind": "stdout", "handle": process.handle, "bytes": Uint8Array.of(0xE2),
    }));
    onEvent(Object.freeze({
      "kind": "stderr", "handle": process.handle, "bytes": Uint8Array.of(0xF0),
    }));
    onEvent(Object.freeze({
      "kind"  : "terminated",
      "handle": process.handle,
      "code"  : 0,
      "signal": null,
    }));

    return process;
  });

  expect(debugSpy.mock.calls.map(call => call[2]).filter(Boolean)).toEqual(["🙂", "�"]);
  expect(errorSpy.mock.calls.map(call => call[2]).filter(Boolean)).toEqual(["€", "�"]);
  expect(GlobalInternals.serverProcesses).toEqual([]);
});

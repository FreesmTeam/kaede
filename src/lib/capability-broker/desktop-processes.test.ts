import { expect, test } from "vitest";

import type {
  RawBrokerEvent,
} from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  createPluginProcess,
} from "@/lib/capability-broker/desktop-processes.ts";

test("keeps plugin process wait pending after an error until termination", async () => {
  let onEvent: ((event: RawBrokerEvent) => void) | undefined;
  const call: BrokerCall = async (_request, eventHandler) => {
    onEvent = eventHandler;

    return { "kind": "process_spawned", "handle": "process:test", "pid": 41 };
  };
  const process = await createPluginProcess(call, "/bin/test", []);
  let settled = false;

  void process.wait().then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  onEvent?.({
    "kind"   : "error",
    "handle" : "process:test",
    "message": "diagnostic only",
  });
  await Promise.resolve();
  expect(settled).toBe(false);

  onEvent?.({
    "kind"  : "terminated",
    "handle": "process:test",
    "code"  : 0,
    "signal": null,
  });
  await expect(process.wait()).resolves.toEqual({
    "code"  : 0,
    "signal": null,
    "stdout": [],
    "stderr": [],
  });
});

test("rejects plugin process wait on terminal failure", async () => {
  let onEvent: ((event: RawBrokerEvent) => void) | undefined;
  const call: BrokerCall = async (_request, eventHandler) => {
    onEvent = eventHandler;

    return { "kind": "process_spawned", "handle": "process:test", "pid": 42 };
  };
  const process = await createPluginProcess(call, "/bin/test", []);

  onEvent?.({
    "kind"   : "failed",
    "handle" : "process:test",
    "message": "wait failed after cleanup",
  });

  await expect(process.wait()).rejects.toThrow("wait failed after cleanup");
});

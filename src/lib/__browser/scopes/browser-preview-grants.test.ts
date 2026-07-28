import { expect, test } from "vitest";

import {
  createMemoryStorage,
  grant,
  noEventCapability,
  principal,
} from "@/lib/browser/scopes/create-browser-capability-broker.test-helpers.ts";
import {
  createBrowserCapabilityBroker,
} from "@/lib/browser/scopes/create-browser-capability-broker.ts";

const PROCESS_PERMISSION = {
  "id"   : "system/process/spawn",
  "scope": { "executables": [{ "path": "/logical/tool", "arguments": [] }] },
} as const;
const STORAGE_PERMISSION = {
  "id"   : "storage/internal/write",
  "scope": { "directory": "principal" },
} as const;

test.each([
  ["storage/internal/write", "system/process/spawn"],
  ["system/process/spawn", "storage/internal/write"],
] as const)(
  "browser plugin sessions reject incompatible grants in order %s then %s",
  async (firstPermission, rejectedPermission) => {
    const runtime = await createBrowserCapabilityBroker(
      noEventCapability,
      createMemoryStorage(),
    );
    const session = await runtime.openPluginSession(principal());
    const firstDescriptor = firstPermission === "system/process/spawn"
      ? PROCESS_PERMISSION
      : STORAGE_PERMISSION;
    const rejectedDescriptor = rejectedPermission === "system/process/spawn"
      ? PROCESS_PERMISSION
      : STORAGE_PERMISSION;

    await grant(runtime, session, firstDescriptor);
    await expect(grant(runtime, session, rejectedDescriptor)).rejects.toThrow(
      "system/process/spawn cannot be combined with storage write permissions",
    );

    const unauthorizedOperation = rejectedPermission === "system/process/spawn"
      ? session.capabilityFactories[rejectedPermission]().spawn({
        "path": "/logical/tool", "arguments": [],
      })
      : session.capabilityFactories[rejectedPermission]().writeText(
        "blocked.txt",
        "blocked",
      );

    await expect(unauthorizedOperation).rejects.toThrow("has not been granted");
  },
);

test("browser grantAll rejects an incompatible batch atomically", async () => {
  const runtime = await createBrowserCapabilityBroker(noEventCapability, createMemoryStorage());
  const session = await runtime.openPluginSession(principal());
  const [processPrepared] = await runtime.preparePermissionRequests([PROCESS_PERMISSION]);
  const [storagePrepared] = await runtime.preparePermissionRequests([STORAGE_PERMISSION]);

  if (processPrepared === undefined || storagePrepared === undefined) {
    throw new TypeError("Expected browser permission preparation to preserve both descriptors");
  }

  await expect(session.grantAll([processPrepared, storagePrepared])).rejects.toThrow(
    "system/process/spawn cannot be combined with storage write permissions",
  );
  await expect(session.capabilityFactories["system/process/spawn"]().spawn({
    "path": "/logical/tool", "arguments": [],
  })).rejects.toThrow("has not been granted");
  await expect(session.capabilityFactories["storage/internal/write"]().writeText(
    "blocked.txt",
    "blocked",
  )).rejects.toThrow("has not been granted");
});

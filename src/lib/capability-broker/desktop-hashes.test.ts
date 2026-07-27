import { expect, test } from "vitest";

import {
  createIpcMock,
  type InvokeArguments,
  noEventCapability,
} from "@/lib/capability-broker/desktop-adapter.test-helpers.ts";
import {
  createDesktopCapabilityBroker,
} from "@/lib/capability-broker/desktop-adapter.ts";

test("routes exact hash bytes through typed host-only broker operations", async () => {
  const { calls, ipc } = createIpcMock();
  const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);

  await expect(runtime.host.hashes.md5(new Uint8Array)).resolves.toBe(
    "d41d8cd98f00b204e9800998ecf8427e",
  );
  await expect(runtime.host.hashes.sha256(new Uint8Array)).resolves.toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );

  const routed = calls.filter(({ args }) => {
    const kind = (args as Partial<InvokeArguments>)?.request?.kind;

    return kind === "host_hash_md5" || kind === "host_hash_sha256";
  });

  expect(routed.map(({ args }) => args)).toEqual([
    {
      "session": "host-secret",
      "request": { "kind": "host_hash_md5", "bytes": [] },
      "events" : undefined,
    },
    {
      "session": "host-secret",
      "request": { "kind": "host_hash_sha256", "bytes": [] },
      "events" : undefined,
    },
  ]);
});

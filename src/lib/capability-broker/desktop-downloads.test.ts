import { expect, test } from "vitest";

import {
  createIpcMock,
  type InvokeArguments,
  noEventCapability,
} from "@/lib/capability-broker/desktop-adapter.test-helpers.ts";
import {
  createDesktopCapabilityBroker,
} from "@/lib/capability-broker/desktop-adapter.ts";

test("exposes host-only download batching and cancel-id-scoped cancellation", async () => {
  const { calls, ipc } = createIpcMock();
  const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);
  const snapshots: Array<unknown> = [];
  const report = await runtime.host.downloads.batch({
    "entries": [{
      "url" : "https://example.test/example.jar",
      "path": "/app/data/libraries/example.jar",
    }],
    "concurrency": 8,
    "label"      : "libraries",
    "cancelId"   : "example-download",
  }, snapshot => {
    snapshots.push(snapshot);
  });

  await expect(runtime.host.downloads.cancel("example-download")).resolves.toBe(true);
  expect(report).toEqual({
    "success"  : 1,
    "failed"   : 0,
    "cancelled": false,
    "failures" : [],
  });
  expect(snapshots).toEqual([
    {
      "current": { "/app/data/libraries/example.jar": [75, 4096] },
      "success": 0,
      "failed" : 0,
    },
    { "current": {}, "success": 1, "failed": 0 },
  ]);

  const downloadCalls = calls.filter(({ args }) => {
    const kind = (args as Partial<InvokeArguments>)?.request?.kind;

    return kind === "host_download_batch" || kind === "host_cancel_downloads";
  });

  expect(downloadCalls.map(({ args }) => args)).toEqual([
    {
      "session": "host-secret",
      "request": {
        "kind"   : "host_download_batch",
        "entries": [{
          "url" : "https://example.test/example.jar",
          "path": "/app/data/libraries/example.jar",
        }],
        "concurrency": 8,
        "label"      : "libraries",
        "cancelId"   : "example-download",
      },
      "events": expect.any(Object),
    },
    {
      "session": "host-secret",
      "request": { "kind": "host_cancel_downloads", "cancelId": "example-download" },
      "events" : undefined,
    },
  ]);
});

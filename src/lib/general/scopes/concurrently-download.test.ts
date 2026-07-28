import { beforeEach, expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { concurrentlyDownload } from "@/lib/general/scopes/concurrently-download.ts";
import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

const brokerMocks = vi.hoisted(() => ({
  "batch": vi.fn<HostFacade["downloads"]["batch"]>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": { "downloads": { "batch": brokerMocks.batch } },
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug": vi.fn(),
    "info" : vi.fn(),
  },
}));

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

function report(overrides: Partial<DownloadReportType> = {}): DownloadReportType {
  return {
    "success"  : overrides.success ?? 0,
    "failed"   : overrides.failed ?? 0,
    "cancelled": overrides.cancelled ?? false,
    "failures" : overrides.failures ?? [],
  };
}

function deferred<Value>(): Readonly<{
  "promise": Promise<Value>;
  "resolve": (value: Value) => void;
}> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>(promiseResolve => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("deduplicates paths and ignores an out-of-order cumulative snapshot", async () => {
  const currentStatuses = statuses();

  brokerMocks.batch.mockImplementation(async (_input, onProgress) => {
    onProgress({
      "current": { "/assets/object": [50, 1024] },
      "success": 1,
      "failed" : 0,
    });
    onProgress({
      "current": { "/assets/stale": [25, 512] },
      "success": 0,
      "failed" : 0,
    });

    return report({ "success": 1 });
  });

  await expect(concurrentlyDownload({
    "concurrency": 4,
    "entries"    : [
      { "url": "https://old.example.test/object", "path": "/assets/object" },
      { "url": "https://new.example.test/object", "path": "/assets/object" },
    ],
    "statuses": currentStatuses,
    "label"   : "assets",
    "cancelId": "instance-download",
  })).resolves.toEqual(report({ "success": 1 }));

  expect(brokerMocks.batch).toHaveBeenCalledWith({
    "entries"    : [{ "url": "https://new.example.test/object", "path": "/assets/object" }],
    "concurrency": 4,
    "label"      : "assets",
    "cancelId"   : "instance-download",
    "debug"      : false,
  }, expect.any(Function));
  expect(currentStatuses.downloads).toMatchObject({
    "success"    : 1,
    "failed"     : 0,
    "total"      : 1,
    "cancellable": false,
  });
  expect(currentStatuses.downloads.current.size).toBe(0);
});

test("keeps the shared status cancellable until every concurrent batch settles", async () => {
  const currentStatuses = statuses();
  const assets = deferred<DownloadReportType>();
  const libraries = deferred<DownloadReportType>();

  brokerMocks.batch.mockImplementation(input => {
    return input.label === "assets" ? assets.promise : libraries.promise;
  });

  const assetsTask = concurrentlyDownload({
    "concurrency": 1,
    "entries"    : [{ "url": "https://example.test/asset", "path": "/asset" }],
    "statuses"   : currentStatuses,
    "label"      : "assets",
    "cancelId"   : "shared-download",
  });
  const librariesTask = concurrentlyDownload({
    "concurrency": 1,
    "entries"    : [{ "url": "https://example.test/library", "path": "/library" }],
    "statuses"   : currentStatuses,
    "label"      : "libraries",
    "cancelId"   : "shared-download",
  });

  expect(currentStatuses.downloads.cancellable).toBe(true);

  assets.resolve(report({ "success": 1 }));
  await assetsTask;

  expect(currentStatuses.downloads.cancellable).toBe(true);

  libraries.resolve(report({ "cancelled": true }));
  await librariesTask;

  expect(currentStatuses.downloads).toMatchObject({
    "success"    : 1,
    "failed"     : 0,
    "total"      : 1,
    "cancellable": false,
  });
});

test("clears in-flight entries and active state when the broker call throws", async () => {
  const currentStatuses = statuses();

  brokerMocks.batch.mockImplementation(async (_input, onProgress) => {
    onProgress({
      "current": { "/client.jar": [12, 256] },
      "success": 0,
      "failed" : 0,
    });

    throw new Error("broker disconnected");
  });

  await expect(concurrentlyDownload({
    "concurrency": 1,
    "entries"    : [{ "url": "https://example.test/client", "path": "/client.jar" }],
    "statuses"   : currentStatuses,
    "label"      : "client",
  })).rejects.toThrow("broker disconnected");
  expect(currentStatuses.downloads.current.size).toBe(0);
  expect(currentStatuses.downloads.total).toBe(0);
  expect(currentStatuses.downloads.cancellable).toBe(false);
});

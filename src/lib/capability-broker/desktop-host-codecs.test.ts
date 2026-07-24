import { expect, test } from "vitest";

import {
  toDownloadBatchSnapshot,
  toDownloadReport,
  toFileMetadata,
  toGlobalCpuUsage,
  toInstalledExtensionsReadResult,
  toSystemMemory,
} from "@/lib/capability-broker/desktop-host-codecs.ts";

test("validates and freezes download reports and aggregate snapshots", () => {
  const report = toDownloadReport({
    "success"  : 1,
    "failed"   : 1,
    "cancelled": false,
    "failures" : [{
      "url"  : "https://example.test/failed.jar",
      "path" : "/libraries/failed.jar",
      "error": "HTTP 500",
    }],
  });
  const snapshot = toDownloadBatchSnapshot({
    "current": { "/libraries/current.jar": [37, 1024] },
    "success": 1,
    "failed" : 0,
  });

  expect(report).toEqual({
    "success"  : 1,
    "failed"   : 1,
    "cancelled": false,
    "failures" : [{
      "url"  : "https://example.test/failed.jar",
      "path" : "/libraries/failed.jar",
      "error": "HTTP 500",
    }],
  });
  expect(snapshot.current["/libraries/current.jar"]).toEqual([37, 1024]);
  expect(Object.isFrozen(report)).toBe(true);
  expect(Object.isFrozen(report.failures)).toBe(true);
  expect(Object.isFrozen(report.failures[0])).toBe(true);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.current)).toBe(true);
  expect(Object.isFrozen(snapshot.current["/libraries/current.jar"])).toBe(true);

  expect(() => toDownloadReport({
    "success"  : 0,
    "failed"   : 1,
    "cancelled": false,
    "failures" : [],
  })).toThrow("failed count");
  expect(() => toDownloadBatchSnapshot({
    "current": { "/invalid": [101, 0] },
    "success": 0,
    "failed" : 0,
  })).toThrow("exceeds 100");
  expect(() => toDownloadBatchSnapshot({
    "current": {},
    "success": -1,
    "failed" : 0,
  })).toThrow("success");
});

test("validates host diagnostics and file metadata DTOs", () => {
  expect(toSystemMemory(4_294_967_296, 8_589_934_592)).toEqual({
    "usedBytes" : 4_294_967_296,
    "totalBytes": 8_589_934_592,
  });
  expect(toGlobalCpuUsage(12.5)).toBe(12.5);
  expect(toFileMetadata(1_753_488_000_000)).toEqual({
    "modifiedTimeMilliseconds": 1_753_488_000_000,
  });
  expect(toFileMetadata(null)).toEqual({ "modifiedTimeMilliseconds": null });

  expect(() => toSystemMemory(-1, 1)).toThrow("usedBytes");
  expect(() => toSystemMemory(2, 1)).toThrow("totalBytes");
  expect(() => toGlobalCpuUsage(Number.NaN)).toThrow("global CPU usage");
  expect(() => toFileMetadata(Number.POSITIVE_INFINITY)).toThrow("modified time");
});

test("validates and snapshots installed extension archive DTOs", () => {
  const metadata = { "id": "sample" };
  const result = toInstalledExtensionsReadResult({
    "extensions": [{
      "fileName"      : "sample.kaede",
      metadata,
      "code"          : "void 0",
      "artifactSha256": "a".repeat(64),
    }],
    "failures": [{ "fileName": "broken.zip", "error": "invalid zip" }],
  });

  metadata.id = "mutated";

  expect(result.extensions[0]?.metadata).toEqual({ "id": "sample" });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.extensions)).toBe(true);
  expect(Object.isFrozen(result.extensions[0])).toBe(true);
  expect(Object.isFrozen(result.failures[0])).toBe(true);
  expect(() => toInstalledExtensionsReadResult({
    "extensions": [{
      "fileName"      : "sample.kaede",
      "metadata"      : {},
      "code"          : "void 0",
      "artifactSha256": "not-a-sha256",
    }],
    "failures": [],
  })).toThrow("invalid typed fields");
});

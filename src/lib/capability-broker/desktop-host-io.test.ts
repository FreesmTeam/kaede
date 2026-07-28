import { describe, expect, test } from "vitest";

import type { BrokerRequest, BrokerResponse } from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import { createDesktopHostIo } from "@/lib/capability-broker/desktop-host-io.ts";

type RuntimeHostHttp = Readonly<{
  fetch(input: unknown, init?: unknown): Promise<Response>;
}>;

function createHttpCall(requests: Array<BrokerRequest>): BrokerCall {
  return async request => {
    requests.push(request);

    return {
      "kind"    : "http",
      "response": {
        "status"    : 200,
        "statusText": "OK",
        "headers"   : [{ "name": "content-type", "value": "text/plain" }],
        "body"      : [...(new TextEncoder).encode("payload")],
        "url"       : "https://example.test/final",
        "redirected": true,
      },
    } satisfies BrokerResponse;
  };
}

const malformedDownloadCall: BrokerCall = async () => ({
  "kind"     : "download_report",
  "success"  : 0,
  "failed"   : 1,
  "cancelled": false,
  "failures" : [],
});

describe("desktop host HTTP", () => {
  test("rejects Request input and unsupported init fields before broker I/O", async () => {
    const requests: Array<BrokerRequest> = [];
    const http: RuntimeHostHttp = createDesktopHostIo(createHttpCall(requests)).http;

    await expect(http.fetch(new Request("https://example.test")))
      .rejects.toThrow(/does not accept Request input/u);
    await expect(http.fetch("https://example.test", { "redirect": "manual" }))
      .rejects.toThrow(/does not support field "redirect"/u);
    await expect(http.fetch("https://example.test", {
      "signal": (new AbortController).signal,
    })).rejects.toThrow(/does not support field "signal"/u);
    expect(requests).toEqual([]);
  });

  test("preserves final response metadata when cloned", async () => {
    const requests: Array<BrokerRequest> = [];
    const response = await createDesktopHostIo(createHttpCall(requests)).http.fetch(
      "https://example.test/start",
    );
    const cloned = response.clone();

    expect(response.url).toBe("https://example.test/final");
    expect(response.redirected).toBe(true);
    expect(cloned.url).toBe(response.url);
    expect(cloned.redirected).toBe(response.redirected);
    await expect(response.text()).resolves.toBe("payload");
    await expect(cloned.text()).resolves.toBe("payload");
    expect(requests).toHaveLength(1);
  });
});

describe("desktop host downloads", () => {
  test("routes a typed batch, snapshots, and scoped cancellation through the broker", async () => {
    const requests: Array<BrokerRequest> = [];
    const snapshots: Array<unknown> = [];
    const call: BrokerCall = async (request, onEvent) => {
      requests.push(request);

      if (request.kind === "host_download_batch") {
        onEvent?.({
          "kind"   : "download_batch_progress",
          "current": { "/assets/object": [50, 2048] },
          "success": 0,
          "failed" : 0,
        });
        onEvent?.({
          "kind"   : "download_batch_progress",
          "current": {},
          "success": 1,
          "failed" : 0,
        });

        return {
          "kind"     : "download_report",
          "success"  : 1,
          "failed"   : 0,
          "cancelled": false,
          "failures" : [],
        };
      }

      return { "kind": "boolean", "value": true };
    };
    const downloads = createDesktopHostIo(call).downloads;
    const report = await downloads.batch({
      "entries"    : [{ "url": "https://example.test/object", "path": "/assets/object" }],
      "concurrency": 4,
      "label"      : "assets",
      "cancelId"   : "instance-download",
    }, snapshot => {
      snapshots.push(snapshot);
    });

    await expect(downloads.cancel("instance-download")).resolves.toBe(true);
    expect(requests).toEqual([
      {
        "kind"       : "host_download_batch",
        "entries"    : [{ "url": "https://example.test/object", "path": "/assets/object" }],
        "concurrency": 4,
        "label"      : "assets",
        "cancelId"   : "instance-download",
        "debug"      : false,
      },
      { "kind": "host_cancel_downloads", "cancelId": "instance-download" },
    ]);
    expect(snapshots).toEqual([
      { "current": { "/assets/object": [50, 2048] }, "success": 0, "failed": 0 },
      { "current": {}, "success": 1, "failed": 0 },
    ]);
    expect(report).toEqual({
      "success"  : 1,
      "failed"   : 0,
      "cancelled": false,
      "failures" : [],
    });
  });

  test("rejects a malformed download report", async () => {
    await expect(createDesktopHostIo(malformedDownloadCall).downloads.batch({
      "entries"    : [],
      "concurrency": 1,
      "label"      : "test",
      "cancelId"   : "test-download",
    }, () => {})).rejects.toThrow("failed count");
  });
});

describe("desktop host log streaming", () => {
  test("routes typed stream events and stop requests through the broker", async () => {
    const requests: Array<BrokerRequest> = [];
    const events: Array<unknown> = [];
    const call: BrokerCall = async (request, onEvent) => {
      requests.push(request);

      if (request.kind === "host_stream_logs") {
        onEvent?.({ "kind": "log_snapshot", "lines": ["first"] });
        onEvent?.({ "kind": "log_lines", "lines": ["second"] });
        onEvent?.({ "kind": "log_truncated" });

        return { "kind": "unit" };
      }

      return { "kind": "boolean", "value": true };
    };
    const logs = createDesktopHostIo(call).logs;

    await logs.stream(event => {
      events.push(event);
    });
    await expect(logs.stopStream()).resolves.toBe(true);

    expect(requests).toEqual([
      { "kind": "host_stream_logs" },
      { "kind": "host_stop_log_stream" },
    ]);
    expect(events).toEqual([
      { "type": "snapshot", "data": ["first"] },
      { "type": "lines", "data": ["second"] },
      { "type": "truncated" },
    ]);
    expect(events.every(event => Object.isFrozen(event))).toBe(true);
  });
});

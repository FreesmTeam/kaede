import { beforeEach, describe, expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { handleJsonFile } from "@/lib/file-manager/handle-json-file.ts";

const brokerMocks = vi.hoisted(() => {
  const contents = new Map<string, string>;

  return {
    contents,
    "exists"     : vi.fn<HostFacade["files"]["exists"]>(async path => contents.has(path)),
    "getMetadata": vi.fn<HostFacade["files"]["getMetadata"]>(async () => ({
      "modifiedTimeMilliseconds": null,
    })),
    "readText": vi.fn<HostFacade["files"]["readText"]>(async path => {
      const stored = contents.get(path);

      if (stored === undefined) {
        throw new Error(`Missing test file: ${path}`);
      }

      return stored;
    }),
    "writeText": vi.fn<HostFacade["files"]["writeText"]>(async (path, value) => {
      contents.set(path, value);
    }),
  };
});

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "files": {
      "exists"     : brokerMocks.exists,
      "getMetadata": brokerMocks.getMetadata,
      "readText"   : brokerMocks.readText,
      "writeText"  : brokerMocks.writeText,
    },
  },
}));

beforeEach(() => {
  brokerMocks.contents.clear();
  brokerMocks.exists.mockClear();
  brokerMocks.getMetadata.mockClear();
  brokerMocks.readText.mockClear();
  brokerMocks.writeText.mockClear();
});

describe("handleJsonFile", () => {
  test("initializes a missing JSON file through the host broker", async () => {
    const defaultValue = { "versions": ["1.21.8"] };

    await expect(handleJsonFile({
      "baseDirectory"  : "",
      "path"           : ["/cache.json"],
      "label"          : "version cache",
      "getDefaultValue": async () => defaultValue,
    })).resolves.toBe(defaultValue);

    expect(brokerMocks.contents.get("/cache.json")).toBe(
      JSON.stringify(defaultValue, null, 2),
    );
  });

  test("returns valid stored JSON without overwriting it", async () => {
    const storedValue = { "versions": ["1.21.7"] };
    const getDefaultValue = vi.fn(async () => ({ "versions": [] }));

    brokerMocks.contents.set("/cache.json", JSON.stringify(storedValue));

    await expect(handleJsonFile({
      "baseDirectory": "",
      "path"         : ["/cache.json"],
      "label"        : "version cache",
      getDefaultValue,
    })).resolves.toEqual(storedValue);

    expect(getDefaultValue).not.toHaveBeenCalled();
    expect(brokerMocks.writeText).not.toHaveBeenCalled();
  });

  test("keeps a fresh invalidatable file and returns its stored value", async () => {
    const storedValue = { "versions": ["1.21.7"] };
    const getNewValue = vi.fn(async () => ({ "versions": ["1.21.8"] }));

    brokerMocks.contents.set("/cache.json", JSON.stringify(storedValue));
    brokerMocks.getMetadata.mockResolvedValueOnce({
      "modifiedTimeMilliseconds": new Date("2026-07-23T12:00:00.000Z").valueOf(),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));

    try {
      await expect(handleJsonFile({
        "baseDirectory"  : "",
        "path"           : ["/cache.json"],
        "label"          : "version cache",
        "getDefaultValue": async () => ({ "versions": [] }),
        "invalidation"   : { "days": 7, getNewValue },
      })).resolves.toEqual(storedValue);
    } finally {
      vi.useRealTimers();
    }

    expect(getNewValue).not.toHaveBeenCalled();
    expect(brokerMocks.writeText).not.toHaveBeenCalled();
  });

  test("refreshes an invalidatable file when its mtime is stale", async () => {
    const newValue = { "versions": ["1.21.8"] };
    const getNewValue = vi.fn(async () => newValue);

    brokerMocks.contents.set("/cache.json", JSON.stringify({ "versions": ["1.21.7"] }));
    brokerMocks.getMetadata.mockResolvedValueOnce({
      "modifiedTimeMilliseconds": new Date("2026-07-18T11:59:59.000Z").valueOf(),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));

    try {
      await expect(handleJsonFile({
        "baseDirectory"  : "",
        "path"           : ["/cache.json"],
        "label"          : "version cache",
        "getDefaultValue": async () => ({ "versions": [] }),
        "invalidation"   : { "days": 7, getNewValue },
      })).resolves.toBe(newValue);
    } finally {
      vi.useRealTimers();
    }

    expect(getNewValue).toHaveBeenCalledOnce();
    expect(brokerMocks.contents.get("/cache.json")).toBe(
      JSON.stringify(newValue, null, 2),
    );
    expect(brokerMocks.readText).not.toHaveBeenCalled();
  });

  test("refreshes an invalidatable file when its mtime is unavailable", async () => {
    const newValue = { "versions": ["1.21.8"] };
    const getNewValue = vi.fn(async () => newValue);

    brokerMocks.contents.set("/cache.json", JSON.stringify({ "versions": ["1.21.7"] }));

    await expect(handleJsonFile({
      "baseDirectory"  : "",
      "path"           : ["/cache.json"],
      "label"          : "version cache",
      "getDefaultValue": async () => ({ "versions": [] }),
      "invalidation"   : { "days": 7, getNewValue },
    })).resolves.toBe(newValue);

    expect(getNewValue).toHaveBeenCalledOnce();
  });

  test("falls back without overwriting when file metadata lookup fails", async () => {
    const defaultValue = { "versions": [] };
    const getDefaultValue = vi.fn(async () => defaultValue);
    const getNewValue = vi.fn(async () => ({ "versions": ["1.21.8"] }));

    brokerMocks.contents.set("/cache.json", JSON.stringify({ "versions": ["1.21.7"] }));
    brokerMocks.getMetadata.mockRejectedValueOnce(new Error("metadata unavailable"));

    await expect(handleJsonFile({
      "baseDirectory": "",
      "path"         : ["/cache.json"],
      "label"        : "version cache",
      getDefaultValue,
      "invalidation" : { "days": 7, getNewValue },
    })).resolves.toBe(defaultValue);

    expect(getDefaultValue).toHaveBeenCalledOnce();
    expect(getNewValue).not.toHaveBeenCalled();
    expect(brokerMocks.writeText).not.toHaveBeenCalled();
  });

  test("recovers invalid stored JSON with the default value", async () => {
    const defaultValue = { "versions": ["1.21.8"] };

    brokerMocks.contents.set("/cache.json", "{invalid json");

    await expect(handleJsonFile({
      "baseDirectory"  : "",
      "path"           : ["/cache.json"],
      "label"          : "version cache",
      "getDefaultValue": async () => defaultValue,
    })).resolves.toBe(defaultValue);

    expect(brokerMocks.contents.get("/cache.json")).toBe(
      JSON.stringify(defaultValue, null, 2),
    );
  });

  test("treats a broker existence-check failure as a missing file", async () => {
    const defaultValue = { "versions": ["1.21.8"] };

    brokerMocks.exists.mockRejectedValueOnce(new Error("metadata unavailable"));

    await expect(handleJsonFile({
      "baseDirectory"  : "",
      "path"           : ["/cache.json"],
      "label"          : "version cache",
      "getDefaultValue": async () => defaultValue,
    })).resolves.toBe(defaultValue);

    expect(brokerMocks.contents.get("/cache.json")).toBe(
      JSON.stringify(defaultValue, null, 2),
    );
  });
});

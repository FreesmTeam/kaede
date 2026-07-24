import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  "readDirectory": vi.fn(),
  "readText"     : vi.fn(),
  "readArchives" : vi.fn(),
  "logError"     : vi.fn(),
  "logWarn"      : vi.fn(),
  "logDebug"     : vi.fn(),
  "logInfo"      : vi.fn(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "files": {
      "readDirectory": mocks.readDirectory,
      "readText"     : mocks.readText,
    },
    "extensions": {
      "readInstalledArchives": mocks.readArchives,
    },
  },
}));

vi.mock("@/lib/general", () => ({
  "default": {
    "getCachedBaseDirectory": (): string => "/data",
    "cachedJoin"            : (...parts: ReadonlyArray<string>): string => parts.join("/"),
  },
}));

vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug": mocks.logDebug,
    "info" : mocks.logInfo,
    "warn" : mocks.logWarn,
    "error": mocks.logError,
  },
}));

import { readAllExtensions } from
  "@/lib/extensions-manager/scopes/read-all-extensions.ts";

function archiveMetadata(id: string): Readonly<Record<string, unknown>> {
  return {
    id,
    "logo"      : "plugin.svg",
    "name"      : id,
    "type"      : "sandbox",
    "source"    : "https://example.test/plugins",
    "version"   : "1.0.0",
    "authors"   : ["Kaede"],
    "languages" : ["en"],
    "categories": ["utility"],
    "enabled"   : true,
  };
}

describe("readAllExtensions archive integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readDirectory.mockResolvedValue([]);
    mocks.readArchives.mockResolvedValue({ "extensions": [], "failures": [] });
  });

  test("validates embedded metadata and preserves the broker raw archive digest", async () => {
    mocks.readArchives.mockResolvedValue({
      "extensions": [{
        "fileName"      : "valid.kaede",
        "metadata"      : archiveMetadata("valid.archive"),
        "code"          : "globalThis.validArchive = true;",
        "artifactSha256": "b".repeat(64),
      }],
      "failures": [{ "fileName": "broken.zip", "error": "invalid zip" }],
    });

    await expect(readAllExtensions()).resolves.toEqual([{
      "id"              : "valid.archive",
      "code"            : "globalThis.validArchive = true;",
      "artifactSha256"  : "b".repeat(64),
      "embeddedMetadata": archiveMetadata("valid.archive"),
    }]);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      "Could not read extension archive 'broken.zip':",
      "invalid zip",
    );
  });

  test("isolates an archive whose embedded metadata fails the existing schema", async () => {
    mocks.readArchives.mockResolvedValue({
      "extensions": [
        {
          "fileName"      : "invalid.kaede",
          "metadata"      : { "id": "invalid.archive" },
          "code"          : "void 'invalid'",
          "artifactSha256": "c".repeat(64),
        },
        {
          "fileName"      : "valid.zip",
          "metadata"      : archiveMetadata("valid.archive"),
          "code"          : "void 'valid'",
          "artifactSha256": "d".repeat(64),
        },
      ],
      "failures": [],
    });

    const extensions = await readAllExtensions();

    expect(extensions.map(extension => extension.id)).toEqual(["valid.archive"]);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      "Skipping extension archive 'invalid.kaede' because its metadata is invalid",
    );
  });

  test("fails deterministically when legacy and archive artifacts claim the same ID", async () => {
    mocks.readDirectory.mockResolvedValue([{
      "name"       : "duplicate.js",
      "isFile"     : true,
      "isDirectory": false,
      "isSymlink"  : false,
    }]);
    mocks.readText.mockResolvedValue("void 'legacy'");
    mocks.readArchives.mockResolvedValue({
      "extensions": [{
        "fileName"      : "archive.kaede",
        "metadata"      : archiveMetadata("duplicate"),
        "code"          : "void 'archive'",
        "artifactSha256": "e".repeat(64),
      }],
      "failures": [],
    });

    await expect(readAllExtensions()).rejects.toThrow(
      "Duplicate extension IDs: \"duplicate\" (\"archive.kaede\", \"duplicate.js\")",
    );
  });
});

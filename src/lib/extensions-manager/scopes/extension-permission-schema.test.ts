import { Compile } from "typebox/compile";
import { describe, expect, test } from "vitest";

import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extensions";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

const ExtensionMetadataValidator = Compile(ExtensionMetadataSchema);

function metadata(
  permissions: ExtensionMetadataType["permissions"],
  id = "Example.Plugin",
): ExtensionMetadataType {
  return {
    id,
    "logo"       : "plugin.svg",
    "name"       : "Example plugin",
    "type"       : "sandbox",
    "source"     : "https://example.com/owner/plugin",
    "version"    : "1.0.0",
    "authors"    : ["Example"],
    "languages"  : ["en"],
    "categories" : ["utility"],
    "description": "An example plugin.",
    permissions,
  };
}

describe("extension permission schema", () => {
  test("accepts simple and scoped slash descriptors", () => {
    expect(ExtensionMetadataValidator.Check(metadata([
      "ui/basic",
      {
        "id"   : "storage/internal/read",
        "scope": { "directory": "principal" },
      },
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://example.com"],
          "methods": ["GET"],
        },
      },
    ]))).toBe(true);
  });

  test("rejects old hyphen permission IDs", () => {
    const invalidMetadata = {
      ...metadata([]),
      "permissions": ["ui-basic"],
    };

    expect(ExtensionMetadataValidator.Check(invalidMetadata)).toBe(false);
  });

  test("rejects duplicate permission IDs and scope entries", () => {
    expect(ExtensionMetadataValidator.Check(metadata([
      "logging/write",
      "logging/write",
    ]))).toBe(false);
    expect(ExtensionMetadataValidator.Check(metadata([{
      "id"   : "network/http",
      "scope": {
        "origins": ["https://example.com", "https://example.com"],
        "methods": ["GET"],
      },
    }]))).toBe(false);
  });

  test.each(["__proto__", "Prototype", "CONSTRUCTOR"])(
    "rejects reserved plugin ID: %s",
    id => {
      expect(ExtensionMetadataValidator.Check(metadata([], id))).toBe(false);
    },
  );

  test.each([
    "https://example.com/owner/%2e%2e/plugin",
    "https://example.com/owner/%2F/plugin",
    "https://example.com/owner/%5C/plugin",
    "https://example.com/owner/%C2%85plugin",
    "https://example.com/owner/café-plugin",
    "https://example.com/owner/plugin.git",
  ])("rejects backend-incompatible repository source: %s", source => {
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      source,
    })).toBe(false);
  });

  test("accepts canonical encoded repository sources and scalar-bounded versions", () => {
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      "source" : "https://example.com/owner/caf%C3%A9-plugin",
      "version": "🚀".repeat(128),
    })).toBe(true);
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      "version": "🚀".repeat(129),
    })).toBe(false);
  });

  test("accepts only Rust-canonical IPv4-mapped IPv6 repository hosts", () => {
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      "source": "https://[::ffff:192.0.2.128]/owner/plugin",
    })).toBe(true);
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      "source": "https://[::ffff:c000:280]/owner/plugin",
    })).toBe(false);
  });

  test("rejects a network origin containing a path", () => {
    expect(ExtensionMetadataValidator.Check(metadata([{
      "id"   : "network/http",
      "scope": {
        "origins": ["https://example.com/api"],
        "methods": ["GET"],
      },
    }]))).toBe(false);
  });

  test("requires canonical origins in persisted metadata", () => {
    expect(ExtensionMetadataValidator.Check(metadata([{
      "id"   : "network/http",
      "scope": {
        "origins": ["https://EXAMPLE.com:443/"],
        "methods": ["GET"],
      },
    }]))).toBe(false);
  });

  test.each(["CONNECT", "TRACE", "TRACK"])(
    "rejects non-Fetch HTTP method: %s",
    method => {
      const invalidMetadata = {
        ...metadata([]),
        "permissions": [{
          "id"   : "network/http",
          "scope": {
            "origins": ["https://example.com"],
            "methods": [method],
          },
        }],
      };

      expect(ExtensionMetadataValidator.Check(invalidMetadata)).toBe(false);
    },
  );

  test("keeps metadata description aligned with its string type", () => {
    expect(ExtensionMetadataValidator.Check(metadata([]))).toBe(true);
    expect(ExtensionMetadataValidator.Check({
      ...metadata([]),
      "description": ["not", "a", "string"],
    })).toBe(false);
  });
});

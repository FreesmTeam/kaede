import { describe, expect, it } from "vitest";

import {
  planPlugins,
  TRUSTED_EXTENSIONS_REPOSITORY,
} from "@/lib/extensions-manager/scopes/plugin-planner.ts";
import {
  TRUSTED_ARTIFACT_CATALOG,
} from "@/lib/extensions-manager/scopes/trusted-artifact-catalog.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

const ARTIFACT_HASH = "a".repeat(64);
const TRUSTED_ARTIFACT = TRUSTED_ARTIFACT_CATALOG[0];

if (TRUSTED_ARTIFACT === undefined) {
  throw new TypeError("The trusted artifact catalog must not be empty");
}

function artifact(
  id: string,
  code = `export default ${JSON.stringify(id)}`,
  artifactSha256 = ARTIFACT_HASH,
): ExtensionInfoType {
  return { id, code, artifactSha256 };
}

function metadata(
  id: string,
  overrides: Partial<ExtensionMetadataType> = {},
): ExtensionMetadataType {
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
    ...overrides,
  };
}

describe("planPlugins", () => {
  it("joins exact artifacts in deterministic metadata order", () => {
    const plan = planPlugins({
      "extensions": [artifact("second"), artifact("first")],
      "metadata"  : [
        metadata("first", { "permissions": ["logging/write", "ui/basic"] }),
        metadata("second", { "enabled": false }),
      ],
    });

    expect(plan.plugins.map(plugin => plugin.metadata.id)).toEqual(["first", "second"]);
    expect(plan.plugins[0]?.metadata.permissions).toEqual(["logging/write", "ui/basic"]);
    expect(plan.sandboxed.map(plugin => plugin.metadata.id)).toEqual(["first"]);
    expect(plan.cooperativeTcb).toEqual([]);
    expect(plan.plugins[0]?.principal).toEqual({
      "repositoryOrigin": "https://example.test/plugins",
      "pluginId"        : "first",
      "version"         : "1.0.0",
      "artifactSha256"  : ARTIFACT_HASH,
    });
    expect(plan.plugins[0]?.principalKey).toMatch(
      /^plugin-principal-v2:sha256:[a-f0-9]{64}$/u,
    );
    expect(Object.isFrozen(plan.plugins)).toBe(true);
    expect(Object.isFrozen(plan.plugins[0]?.metadata.authors)).toBe(true);
  });

  it("accepts the exact vetted artifact from raw metadata and uses the catalog origin", () => {
    const rawArtifactSource =
      "https://raw.githubusercontent.com/kaede-basement/trusted-extensions/main/plugins/typescript-chan.js";
    const plan = planPlugins({
      "extensions": [artifact(
        TRUSTED_ARTIFACT.pluginId,
        "reviewed artifact bytes",
        TRUSTED_ARTIFACT.artifactSha256,
      )],
      "metadata": [metadata(TRUSTED_ARTIFACT.pluginId, {
        "type"   : "unrestricted",
        "source" : rawArtifactSource,
        "version": TRUSTED_ARTIFACT.version,
      })],
    });

    expect(plan.cooperativeTcb).toHaveLength(1);
    expect(plan.cooperativeTcb[0]?.trustedArtifact).toBe(true);
    expect(plan.cooperativeTcb[0]?.metadata.source).toBe(rawArtifactSource);
    expect(plan.cooperativeTcb[0]?.principal.repositoryOrigin).toBe(
      TRUSTED_EXTENSIONS_REPOSITORY,
    );
  });

  it("rejects spoofed trusted source with an arbitrary artifact hash", () => {
    expect(() => planPlugins({
      "extensions": [artifact("plugin")],
      "metadata"  : [metadata("plugin", {
        "type"  : "unrestricted",
        "source": TRUSTED_EXTENSIONS_REPOSITORY,
      })],
    })).toThrow("Untrusted unrestricted plugin is forbidden");
  });

  it("preserves disabled unrestricted metadata while executing enabled sandboxes", () => {
    const plan = planPlugins({
      "extensions": [
        artifact("enabled-sandbox"),
        artifact("disabled-unrestricted"),
      ],
      "metadata": [
        metadata("disabled-unrestricted", {
          "enabled": false,
          "type"   : "unrestricted",
          "source" : TRUSTED_EXTENSIONS_REPOSITORY,
        }),
        metadata("enabled-sandbox"),
      ],
    });

    expect(plan.plugins.map(plugin => plugin.metadata.id)).toEqual([
      "disabled-unrestricted",
      "enabled-sandbox",
    ]);
    expect(plan.plugins[0]?.trustedArtifact).toBe(false);
    expect(plan.cooperativeTcb).toEqual([]);
    expect(plan.sandboxed.map(plugin => plugin.metadata.id)).toEqual([
      "enabled-sandbox",
    ]);
  });

  it("keeps a spoofed trusted source in the sandbox without catalog provenance", () => {
    const plan = planPlugins({
      "extensions": [artifact("plugin")],
      "metadata"  : [metadata("plugin", {
        "source": TRUSTED_EXTENSIONS_REPOSITORY,
      })],
    });

    expect(plan.cooperativeTcb).toEqual([]);
    expect(plan.sandboxed).toHaveLength(1);
    expect(plan.sandboxed[0]?.trustedArtifact).toBe(false);
    expect(plan.sandboxed[0]?.principal.repositoryOrigin).toBe(
      TRUSTED_EXTENSIONS_REPOSITORY,
    );
  });

  it.each([
    {
      "label"  : "version",
      "version": `${TRUSTED_ARTIFACT.version}.spoofed`,
      "hash"   : TRUSTED_ARTIFACT.artifactSha256,
    },
    {
      "label"  : "hash",
      "version": TRUSTED_ARTIFACT.version,
      "hash"   : "b".repeat(64),
    },
  ])("rejects the vetted plugin with a mismatched $label", ({ version, hash }) => {
    expect(() => planPlugins({
      "extensions": [artifact(TRUSTED_ARTIFACT.pluginId, "changed", hash)],
      "metadata"  : [metadata(TRUSTED_ARTIFACT.pluginId, {
        "type"  : "unrestricted",
        "source": TRUSTED_EXTENSIONS_REPOSITORY,
        version,
      })],
    })).toThrow("Untrusted unrestricted plugin is forbidden");
  });

  it("does not restore unrestricted execution from a legacy excess option", () => {
    const legacyOptions = {
      "extensions": [artifact("plugin")],
      "metadata"  : [metadata("plugin", {
        "type"  : "unrestricted",
        "source": "https://example.test/community",
      })],
      "allowUnrestrictedUntrusted": true,
    };

    expect(() => planPlugins(legacyOptions)).toThrow(
      "Untrusted unrestricted plugin is forbidden",
    );
  });

  it.each([
    {
      "label"     : "duplicate artifact IDs",
      "extensions": [artifact("plugin"), artifact("plugin")],
      "metadata"  : [metadata("plugin")],
      "message"   : "Duplicate artifact plugin ID",
    },
    {
      "label"     : "duplicate metadata IDs",
      "extensions": [artifact("plugin")],
      "metadata"  : [metadata("plugin"), metadata("plugin")],
      "message"   : "Duplicate metadata plugin ID",
    },
    {
      "label"     : "unknown artifacts",
      "extensions": [artifact("plugin"), artifact("unknown")],
      "metadata"  : [metadata("plugin")],
      "message"   : "Artifacts without metadata: \"unknown\"",
    },
    {
      "label"     : "missing artifacts",
      "extensions": [artifact("plugin")],
      "metadata"  : [metadata("plugin"), metadata("missing")],
      "message"   : "Metadata without artifacts: \"missing\"",
    },
  ])("rejects $label", ({ extensions, "metadata": metadataEntries, message }) => {
    expect(() => planPlugins({
      extensions,
      "metadata": metadataEntries,
    })).toThrow(message);
  });

  it("rejects unsafe IDs before attempting the join", () => {
    expect(() => planPlugins({
      "extensions": [artifact("__proto__")],
      "metadata"  : [metadata("__proto__")],
    })).toThrow("Unsafe artifact plugin ID");
  });
});

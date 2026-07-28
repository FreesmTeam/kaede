import { describe, expect, it, vi } from "vitest";

import {
  createDependencies,
  initialize,
  metadata,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.test-helpers.ts";
import {
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import type {
  PluginPrincipal,
} from "@/lib/extensions-manager/scopes/principal.ts";

describe("ExtensionLifecycleController archive metadata", () => {
  it("uses the broker raw digest for archive principal identity", async () => {
    const code = "globalThis.archiveIdentity = true;";
    const initializeArchive = async (
      name: string,
      artifactSha256: string,
    ): Promise<PluginPrincipal | undefined> => {
      const archiveMetadata = metadata("archive.plugin", { name });
      const harness = createDependencies({
        "artifacts": [{
          "id"              : archiveMetadata.id,
          code,
          artifactSha256,
          "embeddedMetadata": archiveMetadata,
        }],
        "metadataEntries": [],
      });
      const controller = new ExtensionLifecycleController(harness.dependencies);

      await initialize(controller);

      return harness.open.mock.calls[0]?.[0];
    };

    const firstPrincipal = await initializeArchive("First metadata", "b".repeat(64));
    const changedMetadataPrincipal = await initializeArchive(
      "Changed metadata",
      "c".repeat(64),
    );

    expect(firstPrincipal).toMatchObject({
      "pluginId"      : "archive.plugin",
      "artifactSha256": "b".repeat(64),
    });
    expect(changedMetadataPrincipal).toMatchObject({
      "pluginId"      : "archive.plugin",
      "artifactSha256": "c".repeat(64),
    });
    expect(changedMetadataPrincipal).not.toEqual(firstPrincipal);
  });

  it("rejects duplicate legacy and embedded metadata before catalog publication", async () => {
    const embedded = metadata("duplicate.metadata", { "name": "Archive metadata" });
    const harness = createDependencies({
      "artifacts": [{
        "id"              : embedded.id,
        "code"            : "void 0",
        "artifactSha256"  : "d".repeat(64),
        "embeddedMetadata": embedded,
      }],
      "metadataEntries": [metadata(embedded.id, { "name": "Legacy metadata" })],
    });
    const controller = new ExtensionLifecycleController(harness.dependencies);
    const onCatalog = vi.fn();

    await expect(controller.initialize({
      "trustedContainer": Object.create(null) as HTMLElement,
      "maxBounds"       : { "inlineSizePx": 960, "blockSizePx": 540 },
      onCatalog,
    })).rejects.toThrow("Duplicate metadata plugin ID: \"duplicate.metadata\"");
    expect(onCatalog).not.toHaveBeenCalled();
    expect(harness.open).not.toHaveBeenCalled();
  });
});

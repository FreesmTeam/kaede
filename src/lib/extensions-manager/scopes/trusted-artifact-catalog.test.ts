import { describe, expect, it } from "vitest";

import {
  findTrustedArtifactCatalogEntry,
  TRUSTED_ARTIFACT_CATALOG,
} from "@/lib/extensions-manager/scopes/trusted-artifact-catalog.ts";

const REVIEWED_ARTIFACT_SHA256 =
  "20efba53fa1c5a9a861729f3d7a92f99" +
  "e602a70e2b95f1cc2d758971adee4ceb";

describe("trusted artifact catalog", () => {
  it("pins exactly the single reviewed artifact tuple", () => {
    expect(TRUSTED_ARTIFACT_CATALOG).toHaveLength(1);
    expect(TRUSTED_ARTIFACT_CATALOG).toStrictEqual([
      {
        "repositoryOrigin"        : "https://github.com/kaede-basement/trusted-extensions",
        "reviewedRepositoryCommit": "9eca45438539a75a6dd8c90071590abef8128d71",
        "pluginId"                : "typescript-chan",
        "version"                 : "0.1",
        "artifactSha256"          : REVIEWED_ARTIFACT_SHA256,
      },
    ]);
  });

  it("does not expose mutable catalog state or lookup entries", () => {
    const entry = TRUSTED_ARTIFACT_CATALOG[0];

    if (entry === undefined) {
      throw new TypeError("The trusted artifact catalog must not be empty");
    }

    const found = findTrustedArtifactCatalogEntry(entry);

    expect(found).toBe(entry);
    expect(Object.isFrozen(TRUSTED_ARTIFACT_CATALOG)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Reflect.set(entry, "version", "mutated")).toBe(false);
    expect(Reflect.set(TRUSTED_ARTIFACT_CATALOG, "0", Object.freeze({}))).toBe(false);
    expect(findTrustedArtifactCatalogEntry(entry)).toBe(entry);
  });
});

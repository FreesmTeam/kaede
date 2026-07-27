export const TRUSTED_EXTENSIONS_REPOSITORY =
  "https://github.com/kaede-basement/trusted-extensions";

const TRUSTED_EXTENSIONS_REPOSITORY_COMMIT =
  "9eca45438539a75a6dd8c90071590abef8128d71";

export type TrustedArtifactCatalogEntry = Readonly<{
  "repositoryOrigin"        : string;
  "reviewedRepositoryCommit": string;
  "pluginId"                : string;
  "version"                 : string;
  "artifactSha256"          : string;
}>;

export type TrustedArtifactCatalogLookup = Readonly<{
  "pluginId"      : string;
  "version"       : string;
  "artifactSha256": string;
}>;

const TYPESCRIPT_CHAN = Object.freeze({
  "repositoryOrigin"        : TRUSTED_EXTENSIONS_REPOSITORY,
  "reviewedRepositoryCommit": TRUSTED_EXTENSIONS_REPOSITORY_COMMIT,
  "pluginId"                : "typescript-chan",
  "version"                 : "0.1",
  "artifactSha256"          : "20efba53fa1c5a9a861729f3d7a92f99e602a70e2b95f1cc2d758971adee4ceb",
}) satisfies TrustedArtifactCatalogEntry;

/**
 * Host-owned allowlist of reviewed unrestricted artifacts.
 *
 * Metadata is intentionally absent from this trust decision. Each entry and
 * the containing array are frozen so lookup results cannot become a mutable
 * policy escape.
 */
export const TRUSTED_ARTIFACT_CATALOG: ReadonlyArray<TrustedArtifactCatalogEntry> =
  Object.freeze([TYPESCRIPT_CHAN]);

export function findTrustedArtifactCatalogEntry({
  pluginId,
  version,
  artifactSha256,
}: TrustedArtifactCatalogLookup): TrustedArtifactCatalogEntry | undefined {
  return TRUSTED_ARTIFACT_CATALOG.find(entry => {
    return entry.pluginId === pluginId &&
      entry.version === version &&
      entry.artifactSha256 === artifactSha256;
  });
}

import FileStructure from "@/constants/file-structure.ts";
import {
  type DirectoryEntry,
  Host,
  type InstalledExtensionsReadResult,
} from "@/lib/capability-broker";
import { copyAndSort } from "@/lib/collections/copy-array.ts";
import Errors from "@/lib/errors";
import { computeArtifactSha256 } from "@/lib/extensions-manager/scopes/principal.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

type ExtensionCandidate = Readonly<{
  "extension": ExtensionInfoType;
  "source"   : string;
}>;

function compareStrings(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

function metadataId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const id = Reflect.get(value, "id");

  return typeof id === "string" ? id : undefined;
}

async function readLegacyExtension(path: string, filename: string): Promise<ExtensionCandidate> {
  const filePath = General.cachedJoin(path, filename);
  const fileCode = await Host.files.readText(filePath);

  return {
    "extension": {
      "id"            : filename.slice(0, -3),
      "code"          : fileCode,
      "artifactSha256": await computeArtifactSha256(fileCode),
    },
    "source": filename,
  };
}

function collectArchiveExtensions(
  result: InstalledExtensionsReadResult,
): Array<ExtensionCandidate> {
  for (const failure of result.failures) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not read extension archive '${failure.fileName}':`,
      failure.error,
    );
  }

  const candidates: Array<ExtensionCandidate> = [];

  for (const [index, archive] of result.extensions.entries()) {
    const metadata: ExtensionMetadataType | false = Schemas.validate.extension({
      "value": archive.metadata,
      "label": "embedded extension metadata",
      "info" : {
        "id": metadataId(archive.metadata),
        index,
      },
    });

    if (metadata === false) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Skipping extension archive '${archive.fileName}' because its metadata is invalid`,
      );
      continue;
    }

    candidates.push({
      "extension": {
        "id"              : metadata.id,
        "code"            : archive.code,
        "artifactSha256"  : archive.artifactSha256,
        "embeddedMetadata": metadata,
      },
      "source": archive.fileName,
    });
  }

  return candidates;
}

function assertUniqueExtensionIds(candidates: ReadonlyArray<ExtensionCandidate>): void {
  const sourcesById = new Map<string, Array<string>>;

  for (const candidate of candidates) {
    const sources = sourcesById.get(candidate.extension.id);

    if (sources === undefined) {
      sourcesById.set(candidate.extension.id, [candidate.source]);
    } else {
      sources.push(candidate.source);
    }
  }

  const duplicateEntries = [...sourcesById]
    .filter(([, sources]) => sources.length > 1);
  const duplicates = copyAndSort(
    duplicateEntries,
    ([left], [right]) => compareStrings(left, right),
  )
    .map(([id, sources]) => {
      const sortedSources = copyAndSort(sources, compareStrings)
        .map(source => JSON.stringify(source));

      return `${JSON.stringify(id)} (${sortedSources.join(", ")})`;
    });

  if (duplicates.length > 0) {
    throw new TypeError(`Duplicate extension IDs: ${duplicates.join("; ")}`);
  }
}

async function readArchiveResult(): Promise<InstalledExtensionsReadResult> {
  try {
    return await Host.extensions.readInstalledArchives();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not read installed extension archives:",
      Errors.prettify(error),
    );

    return Object.freeze({
      "extensions": Object.freeze([]),
      "failures"  : Object.freeze([]),
    });
  }
}

async function readLegacyDirectory(path: string): Promise<ReadonlyArray<DirectoryEntry>> {
  try {
    return await Host.files.readDirectory(path);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not read the extensions folder:",
      Errors.prettify(error),
    );

    return [];
  }
}

export async function readAllExtensions(): Promise<Array<ExtensionInfoType>> {
  const startTime = performance.now();
  const path = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Extensions.Path,
  );

  if (!path) {
    log.error(__PRE_BUNDLED_FILENAME__, "The extensions folder path in global states is undefined");

    return [];
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Reading the extensions folder");
  const [storedFiles, archiveResult] = await Promise.all([
    readLegacyDirectory(path),
    readArchiveResult(),
  ]);

  const extensionFiles: Array<string> = [];

  for (const file of storedFiles) {
    if (file.isFile && file.name.endsWith(".js")) {
      extensionFiles.push(file.name);
    }
  }
  extensionFiles.sort(compareStrings);

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Total extension files count:",
    (extensionFiles.length + archiveResult.extensions.length).toString(),
  );
  log.debug(__PRE_BUNDLED_FILENAME__, "Fetching the contents of all stored extensions");
  const legacyCandidates: Array<ExtensionCandidate> = await Promise.all(
    extensionFiles.map((filename: string) => {
      // 'Promise#all' expects pending promises, so do not await for Tauri invokes
      return readLegacyExtension(path, filename);
    }),
  );
  const candidates = [...legacyCandidates, ...collectArchiveExtensions(archiveResult)];

  assertUniqueExtensionIds(candidates);

  const extensionCodes = candidates.map(candidate => candidate.extension);
  const endTime = performance.now();
  const timeDifference: string = (endTime - startTime).toFixed(2);

  log.info(__PRE_BUNDLED_FILENAME__, "Finished reading all extensions in:", timeDifference, "ms");

  return extensionCodes;
}

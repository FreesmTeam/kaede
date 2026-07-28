import type {
  DownloadBatchSnapshot,
  DownloadFailure,
  DownloadReport,
  FileMetadata,
  InstalledExtensionArchive,
  InstalledExtensionFailure,
  InstalledExtensionsReadResult,
  SystemMemory,
} from "@/lib/capability-broker/host-types.ts";
import { copyAndSort } from "@/lib/collections/copy-array.ts";

const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;
const MD5_PATTERN = /^[a-f0-9]{32}$/u;

export function toHashDigest(value: string, algorithm: "md5" | "sha256"): string {
  const pattern = algorithm === "md5" ? MD5_PATTERN : SHA_256_PATTERN;

  if (!pattern.test(value)) {
    throw new TypeError(`Host ${algorithm} digest must be lowercase hexadecimal`);
  }

  return value;
}

function requireNonnegativeFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative finite number`);
  }

  return value;
}

function requireNonnegativeSafeInteger(value: number, label: string): number {
  requireNonnegativeFiniteNumber(value, label);

  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }

  return value;
}

export function toSystemMemory(usedBytes: number, totalBytes: number): SystemMemory {
  const used = requireNonnegativeSafeInteger(usedBytes, "System memory usedBytes");
  const total = requireNonnegativeSafeInteger(totalBytes, "System memory totalBytes");

  if (used > total) {
    throw new TypeError("System memory totalBytes must be at least usedBytes");
  }

  return Object.freeze({ "usedBytes": used, "totalBytes": total });
}

export function toGlobalCpuUsage(usage: number): number {
  return requireNonnegativeFiniteNumber(usage, "Host global CPU usage");
}

export function toFileMetadata(
  modifiedTimeMilliseconds: number | null,
): FileMetadata {
  return Object.freeze({
    "modifiedTimeMilliseconds": modifiedTimeMilliseconds === null
      ? null
      : requireNonnegativeSafeInteger(
        modifiedTimeMilliseconds,
        "File modified time",
      ),
  });
}

function exactRecord(
  value: unknown,
  keys: ReadonlyArray<string>,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }

  const record = value as Record<string, unknown>;
  const actualKeys = copyAndSort(Object.keys(record));
  const expectedKeys = copyAndSort(keys);

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError(`${label} has an invalid shape`);
  }

  return record;
}

function toDownloadFailure(value: unknown): DownloadFailure {
  const record = exactRecord(value, ["url", "path", "error"], "Download failure");

  if (
    typeof record.url !== "string" ||
    typeof record.path !== "string" ||
    typeof record.error !== "string"
  ) {
    throw new TypeError("Download failure contains invalid typed fields");
  }

  return Object.freeze({
    "url"  : record.url,
    "path" : record.path,
    "error": record.error,
  });
}

export function toDownloadReport(value: unknown): DownloadReport {
  const record = exactRecord(
    value,
    ["success", "failed", "cancelled", "failures"],
    "Download report",
  );

  if (typeof record.cancelled !== "boolean" || !Array.isArray(record.failures)) {
    throw new TypeError("Download report contains invalid typed fields");
  }

  const success = requireNonnegativeSafeInteger(
    record.success as number,
    "Download report success",
  );
  const failed = requireNonnegativeSafeInteger(
    record.failed as number,
    "Download report failed",
  );
  const failures = Object.freeze(record.failures.map(failure => {
    return toDownloadFailure(failure);
  }));

  if (failures.length !== failed) {
    throw new TypeError("Download report failed count must match its failures");
  }

  return Object.freeze({
    success,
    failed,
    "cancelled": record.cancelled,
    failures,
  });
}

export function toDownloadBatchSnapshot(value: unknown): DownloadBatchSnapshot {
  const record = exactRecord(
    value,
    ["current", "success", "failed"],
    "Download batch snapshot",
  );
  const currentRecord = exactRecord(
    record.current,
    Object.keys(record.current as object),
    "Download batch snapshot current",
  );
  const current: Record<string, readonly [number, number]> = {};

  for (const [path, progress] of Object.entries(currentRecord)) {
    if (!Array.isArray(progress) || progress.length !== 2) {
      throw new TypeError(`Download progress for ${JSON.stringify(path)} is invalid`);
    }

    const percent = requireNonnegativeSafeInteger(
      progress[0] as number,
      `Download percent for ${JSON.stringify(path)}`,
    );
    const bytesPerSecond = requireNonnegativeSafeInteger(
      progress[1] as number,
      `Download speed for ${JSON.stringify(path)}`,
    );

    if (percent > 100) {
      throw new TypeError(`Download percent for ${JSON.stringify(path)} exceeds 100`);
    }

    current[path] = Object.freeze([percent, bytesPerSecond] as const);
  }

  return Object.freeze({
    "current": Object.freeze(current),
    "success": requireNonnegativeSafeInteger(
      record.success as number,
      "Download batch snapshot success",
    ),
    "failed": requireNonnegativeSafeInteger(
      record.failed as number,
      "Download batch snapshot failed",
    ),
  });
}

function toInstalledExtensionArchive(value: unknown): InstalledExtensionArchive {
  const record = exactRecord(
    value,
    ["fileName", "metadata", "code", "artifactSha256"],
    "Installed extension archive",
  );

  if (
    typeof record.fileName !== "string" ||
    typeof record.code !== "string" ||
    typeof record.artifactSha256 !== "string" ||
    !SHA_256_PATTERN.test(record.artifactSha256)
  ) {
    throw new TypeError("Installed extension archive contains invalid typed fields");
  }

  return Object.freeze({
    "fileName"      : record.fileName,
    "metadata"      : structuredClone(record.metadata),
    "code"          : record.code,
    "artifactSha256": record.artifactSha256,
  });
}

function toInstalledExtensionFailure(value: unknown): InstalledExtensionFailure {
  const record = exactRecord(value, ["fileName", "error"], "Installed extension failure");

  if (typeof record.fileName !== "string" || typeof record.error !== "string") {
    throw new TypeError("Installed extension failure contains invalid typed fields");
  }

  return Object.freeze({
    "fileName": record.fileName,
    "error"   : record.error,
  });
}

export function toInstalledExtensionsReadResult(value: unknown): InstalledExtensionsReadResult {
  const record = exactRecord(value, ["extensions", "failures"], "Installed extensions result");

  if (!Array.isArray(record.extensions) || !Array.isArray(record.failures)) {
    throw new TypeError("Installed extensions result arrays are missing");
  }

  return Object.freeze({
    "extensions": Object.freeze(record.extensions.map(extension => {
      return toInstalledExtensionArchive(extension);
    })),
    "failures": Object.freeze(record.failures.map(failure => {
      return toInstalledExtensionFailure(failure);
    })),
  });
}

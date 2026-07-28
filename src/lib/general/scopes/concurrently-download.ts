import { Host } from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  DownloadReportType,
  DownloadSnapshotType,
} from "@/types/launcher/artifacts/download.type.ts";
import type {
  LauncherStatusesDownloadsType,
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

const activeBatchCounts = new WeakMap<LauncherStatusesDownloadsType, number>;

function startCancellableBatch(downloads: LauncherStatusesDownloadsType): void {
  activeBatchCounts.set(downloads, (activeBatchCounts.get(downloads) ?? 0) + 1);
  downloads.cancellable = true;
}

function finishCancellableBatch(downloads: LauncherStatusesDownloadsType): void {
  const remaining = Math.max(0, (activeBatchCounts.get(downloads) ?? 1) - 1);

  if (remaining === 0) {
    activeBatchCounts.delete(downloads);
    downloads.cancellable = false;

    return;
  }

  activeBatchCounts.set(downloads, remaining);
}

export async function concurrentlyDownload({
  concurrency,
  entries,
  statuses,
  label,
  cancelId = `${Math.random()}`,
  debug = false,
}: {
  "concurrency": number;
  "entries"    : ReadonlyArray<Readonly<{ "url": string; "path": string }>>;
  "statuses"   : LauncherStatusesType;
  "label"      : string;
  "cancelId"  ?: string;
  "debug"     ?: boolean;
}): Promise<DownloadReportType> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;
  const uniqueMap = new Map<string, string>(
    // Destination ownership is the shared contract, even when two URLs differ.
    entries.map(({ url, path }) => [path, url]),
  );
  const uniqueArtifacts = [...uniqueMap].map(([path, url]) => ({ url, path }));

  log.debug(
    logPrefix,
    `Removed ${entries.length - uniqueArtifacts.length}/${entries.length} duplicates`,
  );
  log.debug(
    logPrefix,
    `Starting to download ${uniqueArtifacts.length}/${entries.length} objects`,
  );

  if (uniqueArtifacts.length === 0) {
    return Object.freeze({
      "success"  : 0,
      "failed"   : 0,
      "cancelled": false,
      "failures" : Object.freeze([]),
    });
  }

  const downloads = statuses.downloads;
  let previousSuccess: number = 0;
  let previousFailed : number = 0;
  let previousPaths = new Set<string>;

  downloads.total += uniqueArtifacts.length;
  startCancellableBatch(downloads);

  const applySnapshot = (snapshot: DownloadSnapshotType): void => {
    // Events are cumulative. A delayed older event must not regress either counters or files.
    if (snapshot.success < previousSuccess || snapshot.failed < previousFailed) {
      return;
    }

    downloads.success += snapshot.success - previousSuccess;
    downloads.failed += snapshot.failed - previousFailed;
    previousSuccess = snapshot.success;
    previousFailed = snapshot.failed;

    for (const path of previousPaths) {
      if (!Object.prototype.hasOwnProperty.call(snapshot.current, path)) {
        downloads.current.delete(path);
      }
    }

    previousPaths = new Set;

    for (const [path, [percent, bytesPerSecond]] of Object.entries(snapshot.current)) {
      downloads.current.set(path, [percent, bytesPerSecond]);
      previousPaths.add(path);
    }
  };
  const removeUnfinishedFromTotal = (): void => {
    const unfinished = uniqueArtifacts.length - previousSuccess - previousFailed;

    downloads.total = Math.max(0, downloads.total - Math.max(0, unfinished));
  };

  try {
    const report = await Host.downloads.batch({
      "entries": uniqueArtifacts,
      concurrency,
      label,
      cancelId,
      debug,
    }, applySnapshot);

    applySnapshot({
      "current": {},
      "success": report.success,
      "failed" : report.failed,
    });

    if (report.cancelled) {
      log.info(logPrefix, "The Minecraft download tasks were cancelled");
      removeUnfinishedFromTotal();
    }

    return report;
  } catch (error: unknown) {
    removeUnfinishedFromTotal();

    throw error;
  } finally {
    for (const path of previousPaths) {
      downloads.current.delete(path);
    }

    finishCancellableBatch(downloads);
  }
}

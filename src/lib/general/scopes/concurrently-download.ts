import { Channel, invoke } from "@tauri-apps/api/core";

import { log } from "@/lib/logging/scopes/log.ts";
import type {
  DownloadReportType,
  DownloadSnapshotType,
} from "@/types/launcher/artifacts/download.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

export async function concurrentlyDownload({
  concurrency,
  entries,
  statuses,
  label,
  cancelId = `${Math.random()}`,
  debug = false,
}: {
  "concurrency": number;
  "entries"    : Array<{ "url": string; "path": string }>;
  "statuses"   : LauncherStatusesType;
  "label"      : string;
  "cancelId"  ?: string;
  "debug"     ?: boolean;
}): Promise<DownloadReportType> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  log.debug(logPrefix, `Removing duplicates for ${entries.length} objects`);
  const uniqueMap: Map<string, string> = new Map(
    // It is probably better to filter by unique paths rather than unique URLs...
    entries.map(({ url, path }) => [path, url]),
  );
  const uniqueArtifacts: Array<{ "url": string; "path": string }> = [];

  for (const [path, url] of uniqueMap.entries()) {
    uniqueArtifacts.push({ url, path });
  }

  log.debug(
    logPrefix,
    `Removed ${entries.length - uniqueArtifacts.length}/${entries.length} duplicates`,
  );

  log.debug(
    logPrefix,
    `Starting to download ${uniqueArtifacts.length}/${entries.length} objects`,
  );
  statuses.downloads.total = statuses.downloads.total + uniqueArtifacts.length;

  const onProgress = new Channel<DownloadSnapshotType>;

  /*
   * Snapshot data are cumulative, and since 'concurrentlyDownload'
   * might be called more than once at a time, we need to handle proper merging of statuses
   */
  let previousSuccess: number = 0;
  let previousFailed : number = 0;
  let previousPaths  : Set<string> = new Set;

  const applySnapshotData = (success: number, failed: number): void => {
    if (success < previousSuccess || failed < previousFailed) {
      return;
    }

    statuses.downloads.success = statuses.downloads.success + success - previousSuccess;
    statuses.downloads.failed  = statuses.downloads.failed + failed - previousFailed;

    previousSuccess = success;
    previousFailed  = failed;
  };

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  onProgress.onmessage = (snapshot: DownloadSnapshotType): void => {
    const current = statuses.downloads.current;

    for (const path of previousPaths) {
      // If the path is missing, then the download task for this path was finished
      if (!(path in snapshot.current)) {
        current.delete(path);
      }
    }

    previousPaths = new Set;

    for (const [path, fileProgress] of Object.entries(snapshot.current)) {
      /*
       * 'fileProgress' is '[progress, speed]',
       * where 'progress' is accumulated while 'speed' is not
       */
      current.set(path, fileProgress);
      previousPaths.add(path);
    }

    applySnapshotData(snapshot.success, snapshot.failed);
  };

  const report = await invoke<DownloadReportType>("concurrently_download", {
    "entries": uniqueArtifacts,
    concurrency,
    label,
    onProgress,
    cancelId,
    debug,
  });

  applySnapshotData(report.success, report.failed);

  for (const path of previousPaths) {
    statuses.downloads.current.delete(path);
  }

  previousPaths = new Set;

  if (report.cancelled) {
    log.info(logPrefix, "The Minecraft download tasks were cancelled");
    statuses.downloads.total = statuses.downloads.total - (
      uniqueArtifacts.length - report.success - report.failed
    );
  }

  return report;
}

import { Channel, invoke } from "@tauri-apps/api/core";

import Errors from "@/lib/errors";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
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
  delegateToRust = true,
}: {
  "concurrency"    : number;
  "entries"        : Array<{ "url": string; "path": string }>;
  "statuses"       : LauncherStatusesType;
  "label"          : string;
  "delegateToRust"?: boolean;
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

  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug(
    logPrefix,
    `Starting to download ${uniqueArtifacts.length}/${entries.length} objects`,
  );
  statuses.downloads.total = statuses.downloads.total + uniqueArtifacts.length;

  if (delegateToRust) {
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
    });

    applySnapshotData(report.success, report.failed);

    for (const path of previousPaths) {
      statuses.downloads.current.delete(path);
    }

    previousPaths = new Set;

    return report;
  }

  const report: DownloadReportType = {
    "success" : 0,
    "failed"  : 0,
    "failures": [],
  };

  await Promise.all(
    Array
      .from({ "length": concurrency })
      .map(async (_, groupIndex: number): Promise<void> => {
        while (true) {
          if (indexReference.value >= uniqueArtifacts.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${uniqueArtifacts.length}`;
          const index = indexReference.value++;
          const { url, path } = uniqueArtifacts[index];

          log.debug(
            logPrefix,
            `Concurrency group ${groupIndex}: downloading (${entryOutOfTotal}) '${url}'`,
          );
          try {
            await downloadWithProgress({
              url,
              path,
              statuses,
            });
            statuses.downloads.success++;
            report.success++;
          } catch (error: unknown) {
            const errorMessage: string = Errors.prettify(error);

            log.error(
              logPrefix,
              `Concurrency group ${groupIndex}:`,
              `could not download the ${entryOutOfTotal} object:`,
              errorMessage,
            );
            statuses.downloads.failed++;
            report.failed++;
            report.failures.push({ url, path, "error": errorMessage });
          }
        }
      }),
  );

  return report;
}

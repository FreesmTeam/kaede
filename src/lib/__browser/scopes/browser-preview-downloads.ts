import {
  downloadToBrowserStorage,
} from "@/lib/browser/scopes/browser-preview-io.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import type {
  DownloadBatchSnapshot,
  DownloadFailure,
  DownloadProgress,
  DownloadReport,
  HostFacade,
} from "@/lib/capability-broker/types.ts";

type BrowserDownloads = HostFacade["downloads"];
type DownloadBatchInput = Parameters<BrowserDownloads["batch"]>[0];
type DownloadBatchProgressHandler = Parameters<BrowserDownloads["batch"]>[1];
type DownloadInput = Parameters<BrowserDownloads["toFile"]>[0];
type DownloadProgressHandler = Parameters<BrowserDownloads["toFile"]>[1];

type ActiveGroup = {
  "activeBatches": number;
  "controller"   : AbortController;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function progressPercentage(progress: DownloadProgress): number {
  if (progress.total === null || progress.total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round(progress.transferred / progress.total * 100));
}

function createSnapshot(
  current: ReadonlyMap<string, readonly [number, number]>,
  success: number,
  failed: number,
): DownloadBatchSnapshot {
  const entries = [...current].map(([path, progress]) => {
    const frozenProgress: readonly [number, number] = Object.freeze([
      progress[0],
      progress[1],
    ]);

    return [path, frozenProgress] as const;
  });

  return Object.freeze({
    "current": Object.freeze(Object.fromEntries(entries)),
    success,
    failed,
  });
}

function validateBatchInput(input: DownloadBatchInput): void {
  if (!Number.isSafeInteger(input.concurrency) || input.concurrency <= 0) {
    throw new TypeError("Browser download concurrency must be a positive safe integer");
  }

  if (input.cancelId.length === 0) {
    throw new TypeError("Browser download cancelId must not be empty");
  }
}

export function createBrowserDownloads(storage: BrowserStorage): BrowserDownloads {
  const activeGroups = (new Map<string, ActiveGroup>);

  return Object.freeze({
    "toFile": (
      input: DownloadInput,
      onProgress: DownloadProgressHandler,
    ): Promise<void> => {
      return downloadToBrowserStorage(storage, input.url, input.destinationPath, onProgress);
    },
    "batch": async (
      input: DownloadBatchInput,
      onProgress: DownloadBatchProgressHandler,
    ): Promise<DownloadReport> => {
      validateBatchInput(input);
      const activeGroup = activeGroups.get(input.cancelId) ?? {
        "activeBatches": 0,
        "controller"   : new AbortController,
      };
      const { controller } = activeGroup;
      const current = (new Map<string, readonly [number, number]>);
      const failures: Array<DownloadFailure> = [];
      let nextIndex = 0;
      let success = 0;
      let failed = 0;

      activeGroup.activeBatches++;
      activeGroups.set(input.cancelId, activeGroup);

      const emitSnapshot = (): void => {
        onProgress(createSnapshot(current, success, failed));
      };
      const worker = async (): Promise<void> => {
        while (!controller.signal.aborted && nextIndex < input.entries.length) {
          const entry = input.entries[nextIndex++];

          if (entry === undefined) {
            break;
          }

          current.set(entry.path, Object.freeze([0, 0] as const));
          emitSnapshot();

          try {
            await downloadToBrowserStorage(
              storage,
              entry.url,
              entry.path,
              progress => {
                current.set(entry.path, Object.freeze([
                  progressPercentage(progress),
                  progress.bytesPerSecond,
                ] as const));
                emitSnapshot();
              },
              controller.signal,
            );
            success++;
          } catch (error: unknown) {
            if (!controller.signal.aborted) {
              failed++;
              failures.push(Object.freeze({
                "url"  : entry.url,
                "path" : entry.path,
                "error": errorMessage(error),
              }));
            }
          } finally {
            current.delete(entry.path);
            emitSnapshot();
          }
        }
      };

      try {
        const workerCount = Math.min(input.concurrency, input.entries.length);

        await Promise.all(Array.from({ "length": workerCount }, worker));

        return Object.freeze({
          success,
          failed,
          "cancelled": controller.signal.aborted,
          "failures" : Object.freeze(failures),
        });
      } finally {
        activeGroup.activeBatches--;

        if (
          activeGroup.activeBatches === 0 &&
          activeGroups.get(input.cancelId) === activeGroup
        ) {
          activeGroups.delete(input.cancelId);
        }
      }
    },
    "cancel": async (cancelId: string): Promise<boolean> => {
      const activeGroup = activeGroups.get(cancelId);

      if (activeGroup === undefined) {
        return false;
      }

      activeGroup.controller.abort();

      return true;
    },
  });
}

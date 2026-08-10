/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { Channel } from "@tauri-apps/api/core";

import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

/*
 * A replica of the 'downloads.rs' module: worker pool, cancel flags,
 * one progress snapshot per 100 ms tick, and the same report shape.
 *
 * Downloads go through the regular 'fetch', so files are only saved
 * when their hosts allow cross-origin requests. Mojang and Modrinth
 * do allow them; the rest simply lands in the 'failures' report
 */

type DownloadEntryType = {
  "url" : string;
  "path": string;
};

type DownloadSnapshotType = {
  // Path -> [percent, bytes per second]
  "current": Record<string, [number, number]>;
  "success": number;
  "failed" : number;
};

type FailedDownloadType = {
  "url"  : string;
  "path" : string;
  "error": string;
};

type DownloadReportType = {
  "success"  : number;
  "failed"   : number;
  "cancelled": boolean;
  "failures" : Array<FailedDownloadType>;
};

type FileProgressType = {
  "downloaded"    : number;
  "total"         : number;
  "lastDownloaded": number;
};

type CancelEntryType = {
  "cancelled": boolean;
  "batches"  : number;
};

const cancelFlags: Map<string, CancelEntryType> = new Map;

export function cancelBrowserDownloads(cancelId: string): boolean {
  const entry: CancelEntryType | undefined = cancelFlags.get(cancelId);

  if (!entry) {
    return false;
  }

  entry.cancelled = true;

  return true;
}

function registerBatch(cancelId: string): CancelEntryType {
  const entry: CancelEntryType = cancelFlags.get(cancelId) ?? {
    "cancelled": false,
    "batches"  : 0,
  };

  entry.batches = entry.batches + 1;
  cancelFlags.set(cancelId, entry);

  return entry;
}

function deregisterBatch(cancelId: string): void {
  const entry: CancelEntryType | undefined = cancelFlags.get(cancelId);

  if (!entry) {
    return;
  }

  entry.batches = entry.batches - 1;

  if (entry.batches === 0) {
    cancelFlags.delete(cancelId);
  }
}

async function downloadOne(
  entry: DownloadEntryType,
  progress: Map<string, FileProgressType>,
  isCancelled: () => boolean,
): Promise<"done" | "cancelled"> {
  const response: Response = await fetch(entry.url);

  if (!response.ok) {
    throw `the server responded with the '${response.status}' status`;
  }

  const total: number = Number(response.headers.get("content-length") ?? 0);

  progress.set(entry.path, {
    "downloaded"    : 0,
    total,
    "lastDownloaded": 0,
  });

  const chunks: Array<Uint8Array> = [];
  const reader = response.body?.getReader();

  if (reader) {
    while (true) {
      if (isCancelled()) {
        await reader.cancel();

        return "cancelled";
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      chunks.push(value);

      const file: FileProgressType | undefined = progress.get(entry.path);

      if (file) {
        file.downloaded = file.downloaded + value.length;
      }
    }
  }

  const name: string = entry.path.split("/").pop() ?? entry.path;

  await writeToStoragePath(entry.path, new File(chunks, name));

  return "done";
}

export async function concurrentlyDownloadReplica({
  entries,
  concurrency,
  cancelId,
  onProgress,
}: {
  "entries"    : Array<DownloadEntryType>;
  "concurrency": number;
  "cancelId"   : string;
  "onProgress" : Channel<DownloadSnapshotType>;
}): Promise<DownloadReportType> {
  const cancel: CancelEntryType = registerBatch(cancelId);
  const progress: Map<string, FileProgressType> = new Map;
  const failures: Array<FailedDownloadType> = [];

  let success: number = 0;
  let failed: number = 0;
  let nextIndex: number = 0;

  // One snapshot per tick for the whole batch, just like the desktop side
  const ticker = setInterval((): void => {
    const current: Record<string, [number, number]> = {};

    for (const [path, file] of progress) {
      // Ticks are 100ms apart, so delta * 10 is roughly bytes/sec
      const speed: number = (file.downloaded - file.lastDownloaded) * 10;

      file.lastDownloaded = file.downloaded;

      const percent: number = file.total === 0
        ? 0
        : Math.min(Math.floor((file.downloaded * 100) / file.total), 100);

      current[path] = [percent, speed];
    }

    onProgress.onmessage({ current, success, failed });
  }, 100);

  const workers: Array<Promise<void>> = [];
  const workerCount: number = Math.max(concurrency, 1);

  for (let index = 0; index < workerCount; index++) {
    workers.push((async (): Promise<void> => {
      while (true) {
        if (cancel.cancelled) {
          break;
        }

        const entry: DownloadEntryType | undefined = entries[nextIndex];

        nextIndex = nextIndex + 1;

        if (!entry) {
          break;
        }

        try {
          const outcome: "done" | "cancelled" = await downloadOne(
            entry,
            progress,
            () => cancel.cancelled,
          );

          progress.delete(entry.path);

          if (outcome === "cancelled") {
            break;
          }

          success = success + 1;
        } catch (error) {
          progress.delete(entry.path);
          failed = failed + 1;
          failures.push({
            "url"  : entry.url,
            "path" : entry.path,
            "error": String(error),
          });
        }
      }
    })());
  }

  await Promise.all(workers);
  clearInterval(ticker);

  const cancelled: boolean = cancel.cancelled;

  deregisterBatch(cancelId);

  // Final snapshot
  onProgress.onmessage({ "current": {}, success, failed });

  return { success, failed, cancelled, failures };
}

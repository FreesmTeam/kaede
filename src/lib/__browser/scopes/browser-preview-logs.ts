import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import {
  logInBrowser,
  subscribeToBrowserLogs,
  withBrowserLogOperation,
} from "@/lib/browser/scopes/browser-preview-io.ts";
import { joinBrowserPath } from "@/lib/browser/scopes/browser-preview-paths.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import type {
  HostLogs,
  RuntimeSnapshot,
} from "@/lib/capability-broker/types.ts";

type LogStreamHandler = Parameters<HostLogs["stream"]>[0];
type LogInput = Parameters<HostLogs["write"]>[0];

function storedLogLines(value: string | Uint8Array): ReadonlyArray<string> {
  const contents = typeof value === "string" ? value : (new TextDecoder).decode(value);

  return contents === "" ? [] : contents.split("\n");
}

export function createBrowserLogs(
  storage: BrowserStorage,
  runtimeSnapshot: RuntimeSnapshot,
): Readonly<HostLogs> {
  let stopBrowserLogStream: (() => void) | undefined;

  const didStopActiveBrowserLogStream = (): boolean => {
    if (stopBrowserLogStream === undefined) {
      return false;
    }

    const stop = stopBrowserLogStream;

    stopBrowserLogStream = undefined;
    stop();

    return true;
  };

  return Object.freeze({
    "write": (input: LogInput): void => {
      logInBrowser(input.level, input.message, input.location);
    },
    "stream": async (onEvent: LogStreamHandler): Promise<void> => {
      didStopActiveBrowserLogStream();

      let isActive = true;
      let isSnapshotReady = false;
      const unsubscribe = subscribeToBrowserLogs(line => {
        if (!isActive || !isSnapshotReady) {
          return;
        }

        onEvent(Object.freeze({
          "type": "lines",
          "data": Object.freeze([line]),
        }));
      });
      const stop = (): void => {
        isActive = false;
        unsubscribe();
      };

      stopBrowserLogStream = stop;

      try {
        await withBrowserLogOperation(async () => {
          const path = joinBrowserPath(
            runtimeSnapshot.baseDirectory,
            FileStructure.Folders.Logs.Path,
            FileStructure.Folders.Logs.Files.LatestLog,
          );
          const stored = await storage.read(path);

          if (!isActive) {
            return;
          }

          const persisted = stored.kind === "value" ? storedLogLines(stored.value) : [];
          const snapshot = Object.freeze([
            ...persisted,
            ...GlobalInternals.logsInBrowser,
          ]);

          isSnapshotReady = true;
          onEvent(Object.freeze({
            "type": "snapshot",
            "data": snapshot,
          }));
        });
      } catch (error: unknown) {
        if (stopBrowserLogStream === stop) {
          stopBrowserLogStream = undefined;
        }

        stop();
        throw error;
      }
    },
    "stopStream": async (): Promise<boolean> => didStopActiveBrowserLogStream(),
  });
}

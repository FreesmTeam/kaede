import "ses";

import { readTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";

export function handleLoggingPermission({ id, scope }: {
  "id"   : string;
  "scope": "write" | "read" | "stream";
}): unknown {
  switch (scope) {
    case "write": {
      const wrappedLog = (
        method: "debug" | "info" | "warn" | "error",
        ...input: Array<string>
      ): void => {
        return log[method](`${id}`, ...input);
      };

      return harden({
        "debug": (...input: Array<string>): void => wrappedLog("debug", ...input),
        "info" : (...input: Array<string>): void => wrappedLog("info", ...input),
        "warn" : (...input: Array<string>): void => wrappedLog("warn", ...input),
        "error": (...input: Array<string>): void => wrappedLog("error", ...input),
      });
    }
    case "read": {
      const readLogFile = async (): Promise<string> => {
        const path: string = FileManager.join(
          FileManager.getBaseDirectory(),
          FileStructure.Folders.Logs.Path,
          FileStructure.Folders.Logs.Files.LatestLog,
        );
        const current: string = await readTextFile(path);

        log.debug(__PRE_BUNDLED_FILENAME__, `The '${id}' plugin has read logs`);

        return current;
      };

      return harden(readLogFile);
    }
    case "stream": {
      /*
       * TODO: unsure how to implement this one safely
       * maybe the extension will return a function 'onLogStream',
       * which will be used to pass down the log lines?
       */
      return harden({});
    }
  }
}

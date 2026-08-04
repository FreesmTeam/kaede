import { writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { instanceStates } from "@/states/instance.ts";

let lastWritten: string;

export async function sync(): Promise<void> {
  if (lastWritten === undefined) {
    lastWritten = JSON.stringify(GlobalInternals.initialInstances);
  }

  const startTime: number = performance.now();
  const currentInstanceStatesStringy: string = JSON.stringify(instanceStates);

  if (lastWritten === currentInstanceStatesStringy) {
    return log.debug(
      __PRE_BUNDLED_FILENAME__,
      "Seems like instances didn't change. No need for instances metadata sync",
    );
  }

  const metadataPath = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Files.Metadata,
  );

  try {
    await writeTextFile(
      metadataPath,
      JSON.stringify(instanceStates, null, 2),
    );
    lastWritten = currentInstanceStatesStringy;
  } catch (error: unknown) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to sync the instances metadata:",
      Errors.prettify(error),
    );
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Instance metadata file successfully synced in:",
    (performance.now() - startTime).toFixed(1),
    "ms",
  );
}

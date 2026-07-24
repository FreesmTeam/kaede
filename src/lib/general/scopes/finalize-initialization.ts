import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function initializeLauncher({
  config,
  baseDirectory,
  startTime,
}: {
  "config"       : ConfigType;
  "baseDirectory": string;
  "startTime"    : number;
}): Promise<void> {
  const afterExtensions =
    config.extensions.enabled &&
    config.misc.showAfterExtensionsInitialization;

  if (afterExtensions) {
    /*
     * Making the webview window visible means that the launcher successfully started.
     *
     * The 'startTime' variable is not accessible by the deeply nested
     * 'ExtensionLoader.vue' component without exposing that variable through the 'window' object.
     */
    GlobalInternals.startTime = startTime;
  } else {
    /*
     * Webview window is still hidden, so make it visible now
     * because frontend is already loaded by this time
     */
    log.debug(__PRE_BUNDLED_FILENAME__, "Making current webview window visible");
    await getCurrentWebviewWindow().show();

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Launcher successfully initialized in:",
      (performance.now() - startTime).toFixed(1),
      "ms",
    );
  }

  // Cache the default java major version
  GlobalInternals.javaMajor = await General.getJavaMajor();

  log.debug(__PRE_BUNDLED_FILENAME__, "Checking if all directories present");
  const directoriesStartTime = performance.now();
  const foldersArray = Object.values(FileStructure.Folders);

  const directories: Array<string> = foldersArray.map(({ Path }) => {
    return General.cachedJoin(baseDirectory, Path);
  });
  const toCreate: Array<string> = [];

  const statuses: Array<boolean> = await Promise.all(
    directories.map(directory => exists(directory)),
  );

  for (const [index, status] of statuses.entries()) {
    if (!status) {
      log.debug(__PRE_BUNDLED_FILENAME__, `The '${directories[index]}' path is missing`);
      toCreate.push(directories[index]);
    }
  }

  if (toCreate.length === 0) {
    log.info(
      __PRE_BUNDLED_FILENAME__,
      "All launcher directories present. Time spent to check:",
      (performance.now() - directoriesStartTime).toFixed(1),
      "ms",
    );

    return;
  }

  await Promise.all(
    toCreate.map(directory => mkdir(directory)),
  );

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Created all launcher directories in:",
    (performance.now() - directoriesStartTime).toFixed(1),
    "ms",
  );
}

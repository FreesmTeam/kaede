import FileStructure from "@/constants/file-structure.ts";
import { FamousAndOldJavaMajorVersion } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import {
  DirectHost,
  Host,
  type InitializationFinalizationReport,
} from "@/lib/capability-broker";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

async function finalizeBrowserInitialization({
  baseDirectory,
  folders,
}: {
  "baseDirectory": string;
  "folders"      : ReadonlyArray<string>;
}): Promise<InitializationFinalizationReport> {
  // Native Java probing is unavailable in browser preview, so use the existing fallback.
  const javaMajor = await General.getJavaMajor();
  const directories = folders.map(path => General.cachedJoin(baseDirectory, path));
  const statuses = await Host.files.existsMany(directories);
  const createdDirectories: Array<string> = [];

  for (const [index, status] of statuses.entries()) {
    const directory = directories[index];

    if (!status && directory !== undefined) {
      log.debug(__PRE_BUNDLED_FILENAME__, `The '${directory}' path is missing`);
      createdDirectories.push(directory);
    }
  }

  if (createdDirectories.length > 0) {
    await Host.files.ensureDirectories(createdDirectories);
  }

  return {
    createdDirectories,
    javaMajor,
    "javaMajorSource": "unresolved",
  };
}

export async function finalizeInitialization({
  config,
  baseDirectory,
}: {
  "config"       : ConfigType;
  "baseDirectory": string;
}): Promise<void> {
  const afterExtensions =
    config.extensions.enabled &&
    config.misc.showAfterExtensionsInitialization;
  const folders = Object.values(FileStructure.Folders).map(({ Path }) => Path);

  // Start doing the work concurrently with showing the webview window.
  const finalization: Promise<InitializationFinalizationReport> =
    Host.runtime.getCachedSnapshot().kind === "desktop"
      ? Host.runtime.finalizeInitialization({
        baseDirectory,
        folders,
        "javaBinary": config.minecraft.javaBinary,
      })
      : finalizeBrowserInitialization({ baseDirectory, folders });

  if (!afterExtensions) {
    /*
     * Webview window is still hidden, so make it visible now
     * since frontend is already loaded by this time
     */
    log.debug(__PRE_BUNDLED_FILENAME__, "Making current webview window visible");
    await DirectHost.showMainWebview();

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Launcher successfully initialized in:",
      performance.now().toFixed(1),
      "ms",
    );
  }

  let report: InitializationFinalizationReport;

  try {
    report = await finalization;
  } catch (error: unknown) {
    GlobalInternals.javaMajor = FamousAndOldJavaMajorVersion;

    throw error;
  }

  GlobalInternals.javaMajor = report.javaMajor ?? FamousAndOldJavaMajorVersion;

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Default java major: '${report.javaMajor ?? "unknown"}' (got by '${report.javaMajorSource}');`,
    report.createdDirectories.length === 0
      ? "all launcher directories are present"
      : `created directories: ${report.createdDirectories.join(", ")}`,
  );
}

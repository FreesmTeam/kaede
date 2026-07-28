import FileStructure from "@/constants/file-structure.ts";
import { FamousAndOldJavaMajorVersion } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import {
  DirectHost,
  Host,
  type InitializationFinalizationReport,
} from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export type FinalizeInitializationInput = Readonly<{
  "config"       : ConfigType;
  "baseDirectory": string;
}>;

export type FinalizeInitializationDependencies = Readonly<{
  "cachedJoin"  : (...paths: Array<string>) => string;
  "getJavaMajor": () => Promise<number>;
}>;

async function finalizeBrowserInitialization({
  baseDirectory,
  folders,
  dependencies,
}: {
  "baseDirectory": string;
  "folders"      : ReadonlyArray<string>;
  "dependencies" : FinalizeInitializationDependencies;
}): Promise<InitializationFinalizationReport> {
  // Native Java probing is unavailable in browser preview, so use the existing fallback.
  const javaMajor = await dependencies.getJavaMajor();
  const directories = folders.map(path => dependencies.cachedJoin(baseDirectory, path));
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

export async function finalizeInitializationWithDependencies(
  dependencies: FinalizeInitializationDependencies,
  {
    config,
    baseDirectory,
  }: FinalizeInitializationInput,
): Promise<void> {
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
      : finalizeBrowserInitialization({ baseDirectory, folders, dependencies });

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

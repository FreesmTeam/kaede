import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadLogging({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const logPrefix = necessaries.logPrefix;
  const logging = finalizedPatch.logging;

  if (logging === false) {
    log.warn(
      logPrefix,
      "No logging field found. Perhaps, the instance version is pre-1.7?",
    );
    necessaries.statuses.current = LaunchStatus.Logging.Success;

    return true;
  }

  const beforeHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLoggingGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses, cancelId } = necessaries;
  const { url, path } = logging;

  log.debug(logPrefix, "Checking if the logging config exists");
  statuses.current = LaunchStatus.Logging.Checking;

  const [
    directoryExists,
    fileExists,
  ]: [
    boolean,
    boolean,
  ] = await Promise.all([
    exists(directories.logging),
    exists(path),
  ]);

  if (!directoryExists) {
    log.warn(logPrefix, "The logging config directory does not exist");
    await mkdir(directories.logging);
  }

  if (!fileExists) {
    log.warn(logPrefix, "The logging config file does not exist");
    log.debug(logPrefix, "Downloading the logging config file");
    try {
      const report = await General.concurrentlyDownload({
        statuses,
        cancelId,
        "concurrency": 1,
        "entries"    : [{ path, url }],
        "label"      : "logging",
      });

      if (report.cancelled) {
        return false;
      }
    } catch (error: unknown) {
      log.error(
        logPrefix,
        "Could not download the logging config file:",
        Errors.prettify(error),
      );
      statuses.downloads.failed++;
    }
  }

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLoggingGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(logPrefix, "Successfully handled the logging config");
  statuses.current = LaunchStatus.Logging.Success;

  return true;
}

import { mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import Network from "@/lib/network";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadClient({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await Hooks.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const client = finalizedPatch.client;

  if (client === false) {
    return false;
  }

  const { statuses, instance, logPrefix, cancelId } = necessaries;

  log.debug(
    logPrefix,
    `Checking if the main jar exists. SHA1 checks enabled: ${instance.checksum}`,
  );
  statuses.current = LaunchStatus.Client.Checking;
  const mismatches: Array<string> = await FileManager.verifyPaths({
    "paths": [client],
    "sha1" : instance.checksum,
  });
  const isMismatch: boolean =
    mismatches.length > 0 &&
    client.hash !== "ignore";

  if (isMismatch) {
    log.warn(
      logPrefix,
      `The main jar is not valid. SHA1 checks enabled: ${instance.checksum}`,
    );
    log.debug(logPrefix, "Making a directory for the main jar");
    await mkdir(client.directory, { "recursive": true });

    log.debug(logPrefix, "Downloading the main jar");
    try {
      const report = await Network.concurrentlyDownload({
        statuses,
        cancelId,
        "concurrency": 1,
        "entries"    : [{ "path": client.path, "url": client.url }],
        "label"      : "client",
      });

      if (report.cancelled) {
        return false;
      }
    } catch (error: unknown) {
      log.error(
        logPrefix,
        "Could not download the main jar:",
        Errors.prettify(error),
      );
      statuses.downloads.failed++;
    }
  } else {
    log.info(
      logPrefix,
      `The main jar is valid. SHA1 checks enabled: ${instance.checksum}`,
    );
  }

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onMinecraftClientGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(logPrefix, "Successfully handled the main jar");
  statuses.current = LaunchStatus.Client.Success;

  return true;
}

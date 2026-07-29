import { mkdir } from "@tauri-apps/plugin-fs";

import { GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import Network from "@/lib/network";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadLibraries({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await Hooks.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLibrariesGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses, instance, logPrefix, cancelId } = necessaries;
  const artifacts: Array<MappedArtifactType> = finalizedPatch
    .artifacts
    .filter(({ status }) => status !== "empty");

  log.debug(
    logPrefix,
    `Verifying ${artifacts.length} libraries for their existence.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );
  const startTime: number = performance.now();
  const missing: Set<string> = new Set(
    await FileManager.verifyPaths({
      "paths": artifacts,
      "sha1" : instance.checksum,
    }),
  );
  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    logPrefix,
    `Successfully verified ${artifacts.length} libraries in ${totalTime} ms.`,
    `Total mismatches: ${missing.size}.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );

  const missingArtifacts: Array<MappedArtifactType> = artifacts
    .filter(({ path }) => {
      return missing.has(path);
    });

  log.debug(logPrefix, "Initializing missing library and native directories");
  await Promise.all(
    missingArtifacts.map(({ directory }) => mkdir(
      directory,
      { "recursive": true },
    )),
  );

  const report = await Network.concurrentlyDownload({
    statuses,
    cancelId,
    "concurrency": GeneralSettings.ConcurrentDownloads.Libraries,
    "entries"    : missingArtifacts,
    "label"      : "libraries",
  });

  if (report.cancelled) {
    return false;
  }

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onMinecraftLibrariesGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(
    logPrefix,
    `Successfully handled ${artifacts.length} libraries`,
    `and re-downloaded ${missing.size} of them`,
  );
  statuses.current = LaunchStatus.Libraries.Success;

  return true;
}

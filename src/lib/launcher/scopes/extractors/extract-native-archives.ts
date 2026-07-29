import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function extractNativeArchives({
  necessaries,
  paths,
}: {
  "necessaries": PreLaunchInformationType;
  "paths"      : Array<{ "path": string; "exclude": Array<string> }>;
}): Promise<void> {
  const beforeHooksResult: "continue" | void | undefined =
    await Hooks.catchAsyncResponseHooks<void>({
      "scope" : "onNativesExtract",
      "toPass": { necessaries, paths },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { directories, logPrefix } = necessaries;

  log.debug(logPrefix, `Extracting ${paths.length} native archives`);
  const startTime: number = performance.now();

  await FileManager.unzip({
    "from": paths,
    "to"  : directories.natives,
  });

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    logPrefix,
    `Successfully extracted ${paths.length} native archives in ${totalTime} ms`,
  );

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onNativesExtract",
    "toPass": { necessaries, paths },
    "timing": "after",
  });
}

import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getClassPaths({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<{
  "argument"  : [string, string];
  "classPaths": string;
}> {
  const logPrefix = necessaries.logPrefix;

  log.debug(
    logPrefix,
    "Merging all library and client classpaths",
  );
  const classPathsArray: Array<string> = [];

  for (const library of finalizedPatch.artifacts) {
    const shouldBeIncluded: boolean = library.status === "library" || library.status === "empty";

    if (!shouldBeIncluded) {
      continue;
    }

    if (library?.first) {
      classPathsArray.unshift(library.path);
    } else {
      classPathsArray.push(library.path);
    }
  }

  if (finalizedPatch.client) {
    classPathsArray.push(finalizedPatch.client.path);
  }

  const beforeHooksResult: "continue" | {
    "argument"  : [string, string];
    "classPaths": string;
  } | undefined =
    await Hooks.catchAsyncResponseHooks<{
      "argument"  : [string, string];
      "classPaths": string;
    }>({
      "scope" : "onClassPathsGet",
      "toPass": { classPathsArray, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  // The library paths may have duplicates because of the natives
  log.debug(logPrefix, "Removing duplicated classpaths");
  const uniquePaths: Set<string> = new Set(classPathsArray);
  const pathSeparator: string = necessaries.platform === "windows"
    ? ";"
    : ":";
  const classPaths: string = [...uniquePaths].join(pathSeparator);

  log.info(
    logPrefix,
    `Removed ${classPathsArray.length - uniquePaths.size} duplicated classpaths`,
  );

  return {
    "argument"  : ["-cp", "${classpath}"],
    "classPaths": classPaths,
  };
}

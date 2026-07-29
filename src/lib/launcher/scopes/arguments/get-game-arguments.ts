import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getGameArguments({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<Array<string>> {
  const beforeHooksResult: "continue" | Array<string> | undefined =
    await Hooks.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onGameArgumentsGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const logPrefix = necessaries.logPrefix;

  log.debug(logPrefix, "Adding game arguments");

  if (finalizedPatch.minecraftArguments === undefined) {
    log.error(
      logPrefix,
      "Could not get game arguments from version meta",
    );

    throw new Error("No minecraft arguments found in the version metadata");
  }

  const tweakersList: Array<string> = finalizedPatch["+tweakers"] ?? [];
  const argumentsWithTweakers: Array<string> = finalizedPatch.minecraftArguments.split(" ");

  for (const tweaker of tweakersList) {
    argumentsWithTweakers.push("--tweakClass", tweaker);
  }

  argumentsWithTweakers.push(
    "--height",
    necessaries.instance.windowHeight.toString(),
    "--width",
    necessaries.instance.windowWidth.toString(),
    ...(necessaries.instance.add?.gameArguments ?? []),
  );

  const afterHooksResult: "continue" | Array<string> | undefined =
    await Hooks.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onGameArgumentsGet",
      "toPass": { argumentsWithTweakers, necessaries, finalizedPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return argumentsWithTweakers;
}

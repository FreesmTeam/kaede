import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getJavaBinary({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<string> {
  const beforeHooksResult: "continue" | string | undefined =
    await Hooks.catchAsyncResponseHooks<string>({
      "scope" : "onJavaBinaryGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const javaBinary: string = necessaries.user.javaBinary;

  log.debug(
    necessaries.logPrefix,
    `The '${javaBinary}' command name will be used for launching`,
  );

  return javaBinary;
}

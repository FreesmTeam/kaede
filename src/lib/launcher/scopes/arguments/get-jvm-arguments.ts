import { version } from "@tauri-apps/plugin-os";

import { JVMArguments } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getJvmArguments({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<Array<string>> {
  const jvmArguments: Array<string> = [];

  const beforeHooksResult: "continue" | Array<string> | undefined =
    await Hooks.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { jvmArguments, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { platform, logPrefix } = necessaries;

  log.debug(logPrefix, "Adding default JVM arguments");
  jvmArguments.push(
    ...Object.values(JVMArguments.Default),
    ...finalizedPatch["+jvmArgs"],
    ...(necessaries.instance.add?.jvmArguments ?? []),
  );

  let logFilePath: string = "";

  switch (platform) {
    case "windows": {
      log.debug(logPrefix, "Adding Windows-only JVM arguments");

      if (version().slice(0, 2) === "10") {
        log.debug(logPrefix, "Adding Windows 10 specific JVM arguments");
        jvmArguments.push(
          JVMArguments.WindowsNonIterable.DosName,
          JVMArguments.WindowsNonIterable.DosVersion,
        );
      }

      if (finalizedPatch.logging) {
        logFilePath = "file:///" + finalizedPatch.logging.path;
      }

      jvmArguments.push(JVMArguments.WindowsNonIterable.MojangTricks);

      break;
    }
    case "macos": {
      log.debug(logPrefix, "Adding macOS-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      if (finalizedPatch["+traits"].includes("FirstThreadOnMacOS")) {
        jvmArguments.push(JVMArguments.MacOSNonIterable.FirstThread);
      }

      break;
    }
    default: {
      log.debug(logPrefix, "Adding Linux-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      break;
    }
  }

  if (finalizedPatch.logging) {
    log.debug(logPrefix, "Adding logging config to JVM arguments");
    const loggingArguments = finalizedPatch
      .logging
      .argument
      .replace(
        "${path}",
        logFilePath,
      );

    jvmArguments.push(loggingArguments);
  }

  const afterHooksResult: "continue" | Array<string> | undefined =
    await Hooks.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return jvmArguments;
}

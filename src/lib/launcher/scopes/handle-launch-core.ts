import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

type HandleLaunchDependencies = Readonly<{
  "getLauncher": () => Readonly<{
    "createCommand" : typeof import("@/lib/launcher/scopes/create-command.ts")["createCommand"];
    "spawnMinecraft": typeof import("@/lib/launcher/scopes/spawn-minecraft.ts")["spawnMinecraft"];
  }>;
  "Extractors": Readonly<{
    "getNecessaries": typeof import(
      "@/lib/launcher/scopes/extractors/extract-pre-launch-information.ts"
    )["extractPreLaunchInformation"];
    "unzipNatives": typeof import(
      "@/lib/launcher/scopes/extractors/extract-native-archives.ts"
    )["extractNativeArchives"];
  }>;
  "Fetching": Readonly<{
    "downloadAssets": typeof import(
      "@/lib/launcher/scopes/fetching/download-assets.ts"
    )["downloadAssets"];
    "downloadClient": typeof import(
      "@/lib/launcher/scopes/fetching/download-client.ts"
    )["downloadClient"];
    "downloadLogging": typeof import(
      "@/lib/launcher/scopes/fetching/download-logging.ts"
    )["downloadLogging"];
    "downloadLibraries": typeof import(
      "@/lib/launcher/scopes/fetching/download-libraries.ts"
    )["downloadLibraries"];
  }>;
  "Parsers": Readonly<{
    "finalizePatches": typeof import(
      "@/lib/launcher/scopes/parsers/finalize-patches.ts"
    )["finalizePatches"];
  }>;
  "Patches": Readonly<{
    "resolvePatch": typeof import(
      "@/lib/launcher/scopes/patches/resolve-patch.ts"
    )["resolvePatch"];
    "resolveSubPatches": typeof import(
      "@/lib/launcher/scopes/patches/resolve-sub-patches.ts"
    )["resolveSubPatches"];
  }>;
  "Validators": Readonly<{
    "ensurePatchDirectories": typeof import(
      "@/lib/launcher/scopes/validators/ensure-patch-directories.ts"
    )["ensurePatchDirectories"];
    "ensureMinecraftDirectory": typeof import(
      "@/lib/launcher/scopes/validators/ensure-minecraft-directory.ts"
    )["ensureMinecraftDirectory"];
    "initializeAssetsDirectories": typeof import(
      "@/lib/launcher/scopes/validators/initialize-assets-directories.ts"
    )["initializeAssetsDirectories"];
  }>;
}>;

export type HandleLaunchInput = Readonly<{
  "instanceId"     : string;
  "instance"       : InstanceStateType;
  "statuses"       : LauncherStatusesType;
  "userPreferences": PreLaunchInformationType["user"];
  "onClose"        : (instanceId: string) => void;
  "onInput"        : (line: string) => void;
}>;

const failed: LaunchResponseType = {
  "success": false,
  "process": undefined,
};

export function createHandleLaunch({
  getLauncher,
  Extractors,
  Fetching,
  Parsers,
  Patches,
  Validators,
}: HandleLaunchDependencies): (input: HandleLaunchInput) => Promise<LaunchResponseType> {
  return async function handleLaunch({
    instanceId,
    instance,
    statuses,
    userPreferences,
    onClose,
    onInput,
  }: HandleLaunchInput): Promise<LaunchResponseType> {
    const logPrefix: string = `${instanceId}:${__PRE_BUNDLED_FILENAME__}`;
    const necessaries: PreLaunchInformationType | false = Extractors.getNecessaries({
      instanceId,
      instance,
      statuses,
      userPreferences,
      logPrefix,
    });

    // Same as 'necessaries.logPrefix'
    log.info(logPrefix, log.templates.json.contents(
      "Pre-launch information contents",
      necessaries,
    ));

    if (necessaries === false) {
      log.warn(
        // Same as 'necessaries.logPrefix'
        logPrefix,
        "Aborting the launch process due to an error in pre-launch information extraction",
      );

      return failed;
    }

    await Promise.all([
      Validators.ensurePatchDirectories(necessaries),
      Validators.ensureMinecraftDirectory(necessaries),
      Validators.initializeAssetsDirectories(necessaries),
    ]);

    const entryPatch: SpecificPatchMetaType | false = await Patches.resolvePatch({
      necessaries,
      "metadata": {
        "uid": instance.entry,
      },
    });

    if (entryPatch === false) {
      log.warn(
        necessaries.logPrefix,
        "Aborting the launch process due to an error in entry patch resolving",
      );

      return failed;
    }

    const allPatches: Array<SpecificPatchMetaType> = await Patches.resolveSubPatches({
      "patchMeta": entryPatch,
      necessaries,
    });
    const finalizedPatch: FinalizedPatchType = Parsers.finalizePatches({
      "patches": allPatches,
      necessaries,
    });

    log.info(necessaries.logPrefix, log.templates.json.contents(
      "Finalized patch contents",
      {
        ...finalizedPatch,
        "artifacts": "[ ... ] (" + finalizedPatch.artifacts.length + " entries)",
      },
    ));

    const responses: Array<boolean> = await Promise.all([
      Fetching.downloadAssets({ necessaries, finalizedPatch }),
      Fetching.downloadClient({ necessaries, finalizedPatch }),
      Fetching.downloadLogging({ necessaries, finalizedPatch }),
      Fetching
        .downloadLibraries({ necessaries, finalizedPatch })
        .then(async result => {
          if (!result) {
            return false;
          }

          await Extractors.unzipNatives({
            necessaries,
            "paths": finalizedPatch
              .artifacts
              .filter(({ status }) => status === "native")
              .map(({ path }) => path),
          });

          return true;
        }),
    ]);

    for (const status of responses) {
      if (!status) {
        log.warn(
          necessaries.logPrefix,
          "Aborting the launch process due to an error in artifact downloads",
        );

        return failed;
      }
    }

    const command: {
      "java"     : string;
      "arguments": Array<string>;
    } = await getLauncher().createCommand({ necessaries, finalizedPatch });

    return getLauncher().spawnMinecraft({
      command,
      instanceId,
      necessaries,
      onClose,
      onInput,
    });
  };
}

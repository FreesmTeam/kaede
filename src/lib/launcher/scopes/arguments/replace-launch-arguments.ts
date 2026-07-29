import { ApplicationName } from "@/constants/application.ts";
import { Patches } from "@/constants/meta.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  ArgumentAuthReplacementsType,
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export function replaceLaunchArguments({
  auth,
  builtLaunchArguments,
  necessaries,
  finalizedPatch,
  javaBinary,
}: {
  "auth": {
    "username": string;
    "token"   : string;
    "uuid"    : string;
    "type"    : string;
  };
  "builtLaunchArguments": {
    "toReplace" : Array<string>;
    "classPaths": string;
  };
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
  "javaBinary"    : string;
}): Array<string> {
  const { directories, instance, logPrefix } = necessaries;
  const assetIndexId: string = finalizedPatch?.assetIndex?.id ?? "";
  const toReplace: Array<string> = builtLaunchArguments.toReplace;
  const applicationVersion: string = GlobalInternals.launcherVersion;

  log.debug(logPrefix, "Initializing replacements (without auth)");
  const replacements: ArgumentReplacementsType = {
    "assets_index_name"    : assetIndexId,
    "assets_root"          : directories.assets,
    "classpath"            : builtLaunchArguments.classPaths,
    // Present in newer versions
    "clientid"             : "",
    "game_assets"          : directories.assets,
    "game_directory"       : directories.instance,
    "launcher_name"        : ApplicationName,
    "launcher_version"     : applicationVersion,
    "natives_directory"    : directories.natives,
    // 'The host of the multiplayer server'
    "quickPlayMultiplayer" : "",
    // 'Where to output the logs files, relative to .minecraft'
    "quickPlayPath"        : "",
    // 'The ID of the Minecraft Realms'
    "quickPlayRealms"      : "",
    // 'The path to the singleplayer world'
    "quickPlaySingleplayer": "",
    "resolution_height"    : instance.windowHeight.toString(),
    "resolution_width"     : instance.windowWidth.toString(),
    // Used by old versions
    "user_properties"      : JSON.stringify({
      "kaede": ["unknown"],
    }),
    // 'msa', 'mojang', or 'offline' (?)
    "user_type"          : auth.type,
    "version_name"       : instance.patchVersions[Patches.Minecraft],
    "version_type"       : `${ApplicationName} ${applicationVersion}`,
    // Introduced by Kaede
    "libraries_directory": directories.libraries,
    "main_jar_path"      : (finalizedPatch.client || { "path": "none" }).path,
  };

  const beforeHooksResult: "continue" | Array<string> | undefined =
    Hooks.catchSyncResponseHooks<Array<string>>({
      "scope" : "onLaunchArgumentsReplace",
      "toPass": {
        auth,
        replacements,
        builtLaunchArguments,
        necessaries,
        finalizedPatch,
        javaBinary,
      },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  log.debug(logPrefix, "Building a replacements regex (without auth)");
  const keysRegex: RegExp = new RegExp(
    Object
      .keys(replacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  log.debug(
    logPrefix,
    "Replacing placeholders in the launch command (without auth)",
  );
  const handledReplaces: Array<string> = toReplace.map(argument => (
    argument.replace(keysRegex, matched => {
      // 'matched' is in the '${text}' format, but we need 'text'
      const key = matched.slice(2, -1) as keyof ArgumentReplacementsType;

      return replacements[key];
    })
  ));

  log.info(
    logPrefix,
    "The launching command (auth data is not replaced yet):",
    "\n" + javaBinary + " " + handledReplaces.join(" "),
  );

  log.debug(logPrefix, "Initializing auth replacements");
  const authReplacements: ArgumentAuthReplacementsType = {
    "auth_access_token": auth.token,
    "auth_player_name" : auth.username,
    // Used in 1.6.4
    "auth_session"     : auth.token,
    "auth_uuid"        : auth.uuid,
    // 'Only present in newer versions with Microsoft integration'
    "auth_xuid"        : auth.uuid,
  };

  const afterHooksResult: "continue" | Array<string> | undefined =
    Hooks.catchSyncResponseHooks<Array<string>>({
      "scope" : "onLaunchArgumentsReplace",
      "toPass": {
        auth,
        authReplacements,
        replacements,
        builtLaunchArguments,
        necessaries,
        finalizedPatch,
        javaBinary,
      },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.debug(logPrefix, "Building an auth replacements regex");
  const authKeysRegex: RegExp = new RegExp(
    Object
      .keys(authReplacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  log.debug(logPrefix, "Replacing auth placeholders in the launch command");

  return handledReplaces.map(argument => argument.replace(authKeysRegex, matched => {
    // 'matched' is in the '${text}' format, but we need 'text'
    const key = matched.slice(2, -1) as keyof ArgumentAuthReplacementsType;

    return authReplacements[key];
  }));
}

import { CustomPatches, Patches } from "@/constants/meta.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

export const FamousAndOldJavaMajorVersion = 8;
export const DefaultInstanceIcon = "https://minecraft.wiki/images/Minecraft_Preview_App_Store_icon_2.png";
export const DefaultInstanceSettings: Omit<InstanceStateType, "patchVersions"> = {
  "name"        : "Minecraft - Vanilla",
  "icon"        : DefaultInstanceIcon,
  "windowHeight": 480,
  "windowWidth" : 854,
  "checksum"    : true,
  "pinned"      : false,
  "groups"      : [],
  "entry"       : Patches.Minecraft,
  "javaBinary"  : "java",
  "add"         : {
    "jvmArguments" : ["-Xms4096m", "-Xmx6144m"],
    "gameArguments": [],
  },
  "remove"    : {},
  "playTime"  : 0,
  "lastLaunch": 0,
};
export const JVMArguments = {
  "Default": {
    "Log4J"                      : "-Dlog4j2.formatMsgNoLookups=true",
    "SystemProxies"              : "-Djava.net.useSystemProxiestrue",
    "FMLIgnoreCertificates"      : "-Dfml.ignoreInvalidMinecraftCertificates=true",
    "FMLIgnorePatchDiscrepancies": "-Dfml.ignorePatchDiscrepancies=true",
    "LibrariesDirectory"         : "-DlibraryDirectory=${libraries_directory}",
    "NativesPath"                : "-Djava.library.path=${natives_directory}",
    "ClientJAR"                  : "-Dminecraft.client.jar=${main_jar_path}",
    "TemporaryNativesPath"       : "-Djna.tmpdir=${natives_directory}",
    "SharedLibraryExtractPath":
      "-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}",
    "NettyWorkingDirectory": "-Dio.netty.native.workdir=${natives_directory}",
    "LauncherBrand"        : "-Dminecraft.launcher.brand=${launcher_name}",
    "LauncherVersion"      : "-Dminecraft.launcher.version=${launcher_version}",
    "UserLanguage"         : "-Duser.language=en",
  },
  "WindowsNonIterable": {
    "DosName"   : "-Dos.name=Windows 10",
    "DosVersion": "-Dos.version=10.0",
    "MojangTricks":
      "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
  },
  "MacOSNonIterable": {
    "FirstThread": "-XstartOnFirstThread",
  },
  "LinuxNonIterable": {},
} as const;
export const LaunchStatus = {
  "General": {
    "Starting": "general-pending-starting",
    "Aborted" : "general-aborted",
    "Success" : "general-success",
  },
  "PatchIndex": {
    "Reading"         : "patch-index-pending-reading",
    "Fetching"        : "patch-index-pending-fetching",
    "FailedToFetch"   : "patch-index-error-fetch",
    "FailedToParse"   : "patch-index-error-parse",
    "FailedToValidate": "patch-index-error-validation",
    "Success"         : "patch-index-success",
  },
  "PatchMetadata": {
    "Reading"         : "patch-metadata-pending-reading",
    "Fetching"        : "patch-metadata-pending-fetching",
    "FailedToFetch"   : "patch-metadata-error-fetch",
    "FailedToParse"   : "patch-metadata-error-parse",
    "FailedToValidate": "patch-metadata-error-validation",
    "Success"         : "patch-metadata-success",
  },
  "AssetIndex": {
    "Reading"         : "asset-index-pending-reading",
    "Fetching"        : "asset-index-pending-fetching",
    "FailedToGet"     : "asset-index-error-get",
    "FailedToFetch"   : "asset-index-error-fetch",
    "FailedToParse"   : "asset-index-error-parse",
    "FailedToValidate": "asset-index-error-validation",
    "Success"         : "asset-index-success",
  },
  "AssetObjects": {
    "Success": "asset-objects-success",
  },
  "Libraries": {
    "FailedToValidate": "libraries-error-validation",
    "Success"         : "libraries-success",
  },
  "Logging": {
    "Checking"     : "logging-checking",
    "FailedToParse": "logging-error-parse",
    "Success"      : "logging-success",
  },
  "Client": {
    "Checking"     : "client-checking",
    "FailedToParse": "client-error-parse",
    "Success"      : "client-success",
  },
  "Errors": {
    "UnhandledError"      : "errors-unhandled-error",
    "IncompatiblePlatform": "errors-incompatible-platform",
    "IncompatibleArch"    : "errors-incompatible-arch",
  },
} as const;
// TODO remove this one
export const _LaunchStatus = {
  "General": {
    "Starting": "general-starting",
    "Success" : "general-success",
  },
  "Patches": {
    "ReadingLatestVersion" : "patches-reading-latest-version",
    "FetchingLatestVersion": "patches-fetching-latest-version",
    "Done"                 : "patches-done",
  },
  "Metadata": {
    "ReadingCachedVersionMeta": "meta-reading-cached-version-meta",
    "FetchingVersionMeta"     : "meta-fetching-version-meta",
    "ValidatingVersionMeta"   : "meta-validating-version-meta",
    "ReadingCachedPatchMeta"  : "meta-reading-cached-patch-meta",
    "FetchingPatchMeta"       : "meta-fetching-patch-meta",
  },
  "Assets": {
    "ReadingCachedMeta": "assets-reading-cached-meta",
    "FetchingMeta"     : "assets-fetching-meta",
    "DownloadingAsset" : "assets-downloading-asset",
    "Done"             : "assets-done",
  },
  "Client": {
    "CheckingIfPresent": "client-checking-if-present",
    "DownloadingJar"   : "client-downloading-jar",
    "Done"             : "client-done",
  },
  "Logging": {
    "CheckingIfPresent": "logging-checking-if-present",
    "DownloadingConfig": "logging-downloading-config",
    "Done"             : "logging-done",
  },
  "Libraries": {
    "DownloadingLibrary": "libraries-downloading-library",
    "Done"              : "libraries-done",
  },
  "Errors": {
    "UnhandledError"                    : "error-unhandled-error",
    "UndefinedInstanceVersion"          : "error-undefined-instance-version",
    "IncompatiblePlatform"              : "error-incompatible-platform",
    "IncompatibleArch"                  : "error-incompatible-arch",
    "MetaVersionFetchFailed"            : "error-meta-version-fetch-failed",
    "MetaVersionParseFailed"            : "error-meta-version-parse-failed",
    "MetaVersionShallowValidationFailed": "error-meta-version-shallow-validation-failed",
    "MetaVersionFullValidationFailed"   : "error-meta-version-full-validation-failed",
    "MetaAssetsMissingMeta"             : "error-meta-assets-missing-meta",
    "MetaAssetsFetchFailed"             : "error-meta-assets-fetch-failed",
    "MetaAssetsParseFailed"             : "error-meta-assets-parse-failed",
    "MetaAssetsShallowValidationFailed" : "error-meta-assets-shallow-validation-failed",
    "ClientMainJarMissingMeta"          : "error-client-main-jar-missing-meta",
    "LoggingMissingMeta"                : "error-logging-missing-meta",
    "PatchMissingMeta"                  : "error-patch-missing-meta",
    "PatchFullValidationFailed"         : "error-patch-full-validation-failed",
    "LibrariesMissingMeta"              : "error-libraries-missing-meta",
    "LibraryShallowValidationFailed"    : "error-library-shallow-validation-failed",
    "VersionNotFoundInMeta"             : "error-version-not-found-in-meta",
    "MissingJava"                       : "error-missing-java",
    "IncorrectJavaVersion"              : "error-incorrect-java-version",
  },
} as const;
export const APIEndpoints = {
  "KaedeCache": {
    "Base" : "https://raw.githubusercontent.com/kaede-basement/cache/main/",
    "Paths": {
      "OptiFine": {
        "Id"  : CustomPatches.OptiFine,
        "Base": `${CustomPatches.OptiFine}/`,
      },
    },
  },
  "Meta": {
    "Base" : "https://meta.prismlauncher.org/v1/",
    "Paths": {
      "Minecraft": {
        "Id"  : Patches.Minecraft,
        "Base": `${Patches.Minecraft}/`,
      },
    },
  },
  "Libraries": {
    "Base": "https://libraries.minecraft.net/",
  },
  "Resources": {
    "Base": "https://resources.download.minecraft.net/",
  },

  /*
   * BMCLAPI: https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json
   * "ManifestV2": "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
   */
} as const;
export const GeneralSettings = {
  "ConcurrentDownloads": {
    "Assets"   : 64,
    "Libraries": 8,
  },
  "Logs": {
    // Used only for Minecraft logs. Launcher logs stay uncut
    "LineLimit": 65_536,
  },
} as const;

export default {
  DefaultInstanceIcon,
  DefaultInstanceSettings,
  JVMArguments,
  LaunchStatus,
  APIEndpoints,
  GeneralSettings,
} as const;
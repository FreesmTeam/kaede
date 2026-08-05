import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export type PreLaunchInformationType = {
  "logPrefix": string;
  "statuses" : LauncherStatusesType;
  "platform" : "windows" | "macos" | "linux";
  "arch"     : "x64" | "x86" | "arm64" | "arm32";
  "instance" : InstanceStateType;
  "cancelId" : string;
  "user"     : {
    "javaBinary": string;
    "javaMajor" : number;
    // Selected patch versions
    "versions"  : InstanceStateType["patchVersions"];
    // Auth values of the selected account
    "account"  ?: LaunchAuthType;
  };
  "directories": {
    "base"        : string;
    "instanceRoot": string;
    "instance"    : string;
    "assets"      : string;
    "logging"     : string;
    "libraries"   : string;
    "natives"     : string;
    "assetIndexes": string;
    "assetObjects": string;
  };
};

import type { Raw, Reactive } from "vue";

import type { LaunchStatus } from "@/constants/launcher.ts";

type LaunchStatusObjectType = typeof LaunchStatus;

export type LaunchKeyType = keyof LaunchStatusObjectType;
export type LaunchStatusType = {
  [Key in LaunchKeyType]: LaunchStatusObjectType[Key][keyof LaunchStatusObjectType[Key]];
}[LaunchKeyType];

export type LauncherStatusesDownloadsType = {
  "current": Raw<Map<string, [number, number]>>;
  "success": number;
  "failed" : number;
  "total"  : number;
};
export type LauncherStatusesType = {
  "instanceId": string;
  "launching" : 0 | 1 | 2;
  "current"   : LaunchStatusType | undefined;
  "downloads" : LauncherStatusesDownloadsType;
};
export type WrappedInstanceLauncherStatusesType = Reactive<
  Record<
    string,
    {
      "instanceId": LauncherStatusesType["instanceId"];
      "launching" : LauncherStatusesType["launching"];
      "current"   : LauncherStatusesType["current"];
      "downloads" : LauncherStatusesType["downloads"];
    }
  >
>;

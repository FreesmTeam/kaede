import type { LaunchStatus } from "@/constants/launcher.ts";

type LaunchStatusObjectType = typeof LaunchStatus;

export type LaunchKeyType = keyof LaunchStatusObjectType;
export type LaunchStatusType = {
  [Key in LaunchKeyType]: LaunchStatusObjectType[Key][keyof LaunchStatusObjectType[Key]];
}[LaunchKeyType];

export type LauncherStatusesDownloadsType = {
  "current"    : import("vue").Raw<Map<string, [number, number]>>;
  "success"    : number;
  "failed"     : number;
  "total"      : number;
  "cancellable": boolean;
};
export type LauncherStatusesType = {
  "launching": 0 | 1 | 2;
  "current"  : LaunchStatusType | undefined;
  "downloads": LauncherStatusesDownloadsType;
};
export type WrappedInstanceLauncherStatusesType = import("vue").Reactive<
  Record<
    string,
    {
      "launching": LauncherStatusesType["launching"];
      "current"  : LauncherStatusesType["current"];
      "downloads": LauncherStatusesDownloadsType;
    }
  >
>;

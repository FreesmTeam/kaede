import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export function isDownloadCancellationActive(
  statuses: LauncherStatusesType | undefined,
): boolean {
  return statuses?.launching === 1 && statuses.downloads.cancellable;
}

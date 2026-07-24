import { Host } from "@/lib/capability-broker";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export async function downloadWithProgress({
  url,
  path,
  statuses,
}: {
  "url"     : string;
  "path"    : string;
  "statuses": LauncherStatusesType;
}): Promise<void> {
  await Host.downloads.toFile(
    { "url": url, "destinationPath": path },
    ({ transferred, total, bytesPerSecond }) => {
      const percents = total === null || total === 0
        ? 0
        : Math.floor(transferred / total * 100);

      if (total !== null && transferred >= total) {
        return statuses.downloads.current.delete(url);
      }

      statuses.downloads.current.set(url, [percents, bytesPerSecond]);
    },
  );
  statuses.downloads.current.delete(url);
}

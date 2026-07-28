import { Host } from "@/lib/capability-broker";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

/**
 * Compatibility entry point for trusted plugins that use the published
 * `Kaede.libs.Launcher.Fetching.downloadWithProgress` API.
 */
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
        statuses.downloads.current.delete(url);

        return;
      }

      statuses.downloads.current.set(url, [percents, bytesPerSecond]);
    },
  );
  statuses.downloads.current.delete(url);
}

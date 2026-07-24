import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export async function getLaunchCount(): Promise<number> {
  let count: number;

  try {
    const snapshot = await Host.runtime.getSnapshot();

    count = snapshot.launchCount;
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to retrieve application launch count:",
      Errors.prettify(error),
    );
    count = 0;
  }

  return count;
}

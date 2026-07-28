import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

const FamousAndOldJavaMajorVersion: number = 8;

export async function getJavaMajor(): Promise<number> {
  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting the Java version");
    const majorVersion = await Host.processes.probeJavaMajor();

    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "The current Java major version is:",
      majorVersion.toString(),
    );

    return majorVersion;
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not get the Java version output:",
      Errors.prettify(error),
    );

    return FamousAndOldJavaMajorVersion;
  }
}

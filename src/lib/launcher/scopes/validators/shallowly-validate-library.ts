import { LaunchStatus } from "@/constants/launcher.ts";
import { log } from "@/lib/logging/log.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function shallowlyValidateLibrary({
  statuses,
  library,
  descriptiveLogPrefix,
}: {
  "statuses"            : LauncherStatusesType;
  "library"             : unknown;
  "descriptiveLogPrefix": string;
}): SpecificPatchLibraryType | false {
  if (
    typeof library !== "object" ||
    library === null ||
    !("name" in library)
  ) {
    log.debug(
      descriptiveLogPrefix,
      `The '${JSON.stringify(library)}' is completely invalid`,
    );
    statuses.current = LaunchStatus.Libraries.FailedToValidate;

    return false;
  }

  return library as SpecificPatchLibraryType;
}

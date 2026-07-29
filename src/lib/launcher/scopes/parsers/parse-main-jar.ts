import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { log } from "@/lib/logging/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseMainJar({
  necessaries,
  patch,
}: {
  "necessaries": PreLaunchInformationType;
  "patch"      : SpecificPatchMetaType;
}): MappedArtifactType | false {
  log.debug(__PRE_BUNDLED_FILENAME__, "Parsing the main jar metadata");
  const { directories, statuses, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patch.uid + ":" + logPrefix;
  const client: SpecificPatchMetaType["mainJar"] = patch?.mainJar;
  const name: string | undefined = client?.name;
  const url: string | undefined = client?.downloads?.artifact?.url;
  const hash: string | undefined = client?.downloads?.artifact?.sha1;

  if (
    client === undefined ||
    name === undefined ||
    url === undefined ||
    hash === undefined
  ) {
    log.error(
      descriptiveLogPrefix,
      "The main jar metadata is invalid",
    );
    statuses.current = LaunchStatus.Client.FailedToParse;

    return false;
  }

  const { "directory": relativeDirectory, file } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(
    directory,
    file,
  );

  log.debug(descriptiveLogPrefix, "Parsed the main jar metadata");

  return {
    "id": name,
    url,
    file,
    path,
    hash,
    directory,
  };
}

import { LaunchStatus } from "@/constants/launcher.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLogging({
  necessaries,
  patch,
}: {
  "necessaries": PreLaunchInformationType;
  "patch"      : SpecificPatchMetaType;
}): (MappedArtifactType & {
  "argument": string;
}) | false {
  const { directories, statuses, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patch.uid + ":" + logPrefix;
  const logging: SpecificPatchMetaType["logging"] = patch?.logging;

  log.debug(descriptiveLogPrefix, "Parsing the logging metadata");
  if (
    logging === undefined ||
    logging?.type === undefined ||
    logging?.file === undefined ||
    logging?.argument === undefined
  ) {
    log.warn(descriptiveLogPrefix, log.templates.json.contents(
      "The 'logging' field is invalid. Contents",
      logging,
      true,
    ));
    statuses.current = LaunchStatus.Logging.FailedToParse;

    return false;
  }

  // Already contains an extension (.xml)
  const name: string | undefined = logging.file?.id;
  const url: string | undefined = logging.file?.url;
  const hash: string | undefined = logging.file?.sha1;

  if (!name || !url || !hash) {
    log.warn(descriptiveLogPrefix, "Missing the logging config file metadata");
    statuses.current = LaunchStatus.Logging.FailedToParse;

    return false;
  }

  const path = FileManager.join(
    directories.logging,
    name,
  );

  log.debug(descriptiveLogPrefix, "Parsed the logging metadata");

  return {
    "id"       : name,
    "file"     : name,
    "path"     : path,
    "url"      : url,
    "hash"     : hash,
    "argument" : logging.argument,
    "directory": directories.logging,
  };
}

import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { unifyPlatformWithArch } from "@/lib/launcher/scopes/parsers/unify-platform-with-arch.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchClassifierKeyType,
  SpecificPatchClassifiersType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseNative({
  necessaries,
  library,
  patchUid,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
  "patchUid"   : string;
}): Required<MappedArtifactType> | false {
  const { directories, platform, arch, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patchUid + ":" + library?.name + ":" + logPrefix;
  const name: string | undefined = library?.name;

  if (name === undefined) {
    log.warn(descriptiveLogPrefix, "The native is invalid");

    return false;
  }

  const classifiers: SpecificPatchClassifiersType | undefined = library?.downloads?.classifiers;
  const newFormattedUrl: string | undefined = library?.downloads?.artifact?.url;
  const { "directory": relativeDirectory, file, classifier } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(directory, file);

  // New natives format does not have a 'classifiers' field
  if (classifiers === undefined) {
    const hash: string | undefined = library?.downloads?.artifact?.sha1;

    if (newFormattedUrl === undefined || hash === undefined) {
      log.warn(descriptiveLogPrefix, "The native is invalid");

      return false;
    }

    const artifact: Required<MappedArtifactType> = {

      /*
       * The 'id' field is used to filter out unique artifacts,
       * but the 'name' field is taken by the library already.
       *
       * Example: text2speech and text2speech-natives share the same 'name' field
       */
      "id"    : `${name}-natives`,
      "url"   : newFormattedUrl,
      "status": "native",
      "first" : false,
      directory,
      file,
      path,
      hash,
    };

    if (classifier === undefined) {
      return artifact;
    }

    const {
      "platform": classifierPlatform,
      "arch"    : classifierArch,
    } = unifyPlatformWithArch(classifier);
    const isPlatformCompatible: boolean = classifierPlatform === platform;
    const isArchCompatible: boolean =
      classifierArch === "any" ||
      classifierArch === arch;

    if (isPlatformCompatible && isArchCompatible) {
      return artifact;
    }

    log.debug(descriptiveLogPrefix, "The native is not compatible");

    return false;
  }

  for (const [currentClassifier, { sha1, "url": nativesUrl }] of Object.entries(classifiers)) {
    const {
      "platform": classifierPlatform,
      "arch"    : classifierArch,
    } = unifyPlatformWithArch(currentClassifier as SpecificPatchClassifierKeyType);
    const isPlatformCompatible: boolean = classifierPlatform === platform;
    const isArchCompatible: boolean =
      classifierArch === "any" ||
      classifierArch === arch;

    if (!isPlatformCompatible || !isArchCompatible) {
      continue;
    }

    const suffix = `-natives-${platform === "macos" ? "osx" : platform}`;
    const currentNaming: Array<string> = file.split(".");
    const extension: string = currentNaming.pop() ?? "jar";

    const requiredName: string =
      currentNaming.join(".") +
      suffix +
      "." +
      extension;
    const updatedPath: string = General.cachedJoin(directory, requiredName);

    return {

      /*
       * The 'id' field is used to filter out unique artifacts,
       * but the 'name' field is taken by the library already.
       *
       * Example: text2speech and text2speech-natives share the same 'name' field
       */
      "id"       : `${name}-natives`,
      "directory": directory,
      "file"     : requiredName,
      "path"     : updatedPath,
      "url"      : nativesUrl,
      "hash"     : sha1,
      "status"   : "native",
      "first"    : false,
    };
  }

  log.debug(descriptiveLogPrefix, "The native is not compatible");

  return false;
}

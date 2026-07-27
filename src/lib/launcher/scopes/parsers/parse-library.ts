import { APIEndpoints } from "@/constants/launcher.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLibrary({
  necessaries,
  library,
  isMaven,
  patchUid,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
  "isMaven"    : boolean;
  "patchUid"   : string;
}): Required<MappedArtifactType> | false {
  const { directories, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patchUid + ":" + library?.name + ":" + logPrefix;
  const name: string | undefined = library?.name;
  const baseUrl: string | undefined = library?.url;
  const url: string | undefined = library?.downloads?.artifact?.url;
  const hash: string | undefined = library?.downloads?.artifact?.sha1;

  if (name === undefined) {
    log.warn(descriptiveLogPrefix, `The '${JSON.stringify(library)}' library is invalid`);

    return false;
  }

  const { "directory": relativeDirectory, file, "id": artifactID } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(
    directory,
    file,
  );

  // The 'com.mumfrey.liteloader' patch libraries only have the 'name' fields sometimes
  const isEmpty = baseUrl === undefined && library?.downloads === undefined;

  if (isEmpty) {
    log.warn(
      descriptiveLogPrefix,
      "The library is empty, falling back to:",
      APIEndpoints.Libraries.Base,
    );

    const builtUrl: string | false = GlobalObject.libs.Launcher.Parsers.buildUrlFromBase({
      "baseUrl": APIEndpoints.Libraries.Base,
      name,
      file,
      descriptiveLogPrefix,
    });

    if (builtUrl === false) {
      return false;
    }

    return {
      "id": artifactID,

      /*
       * Turns out, the empty fields should be filled by yourself.
       * Seems like other launchers, e.g. HMCL and Prism Launcher,
       * use the 'https://libraries.minecraft.net/' URL as the base URL
       * for empty libraries
       */
      // "status": "empty",
      "status": "library",
      "url"   : builtUrl,
      "hash"  : "ignore",
      "first" : false,
      directory,
      file,
      path,
    };
  }

  // The 'net.fabricmc.fabric-loader' patch libraries only have the 'name' and 'url' fields
  if (baseUrl !== undefined) {
    const builtUrl: string | false = GlobalObject.libs.Launcher.Parsers.buildUrlFromBase({
      baseUrl,
      name,
      file,
      descriptiveLogPrefix,
    });

    if (builtUrl === false) {
      return false;
    }

    return {
      "id"    : artifactID,
      "status": isMaven ? "mavenFile" : "library",
      "url"   : builtUrl,
      "hash"  : "ignore",
      "first" : false,
      directory,
      file,
      path,
    };
  }

  if (url === undefined || hash === undefined) {
    log.warn(descriptiveLogPrefix, "The library is invalid");

    return false;
  }

  return {
    "id"    : artifactID,
    "status": isMaven ? "mavenFile" : "library",
    "first" : false,
    directory,
    file,
    url,
    path,
    hash,
  };
}

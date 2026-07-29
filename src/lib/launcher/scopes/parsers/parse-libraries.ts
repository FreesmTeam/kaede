import Hooks from "@/lib/hooks";
import { checkIsNative } from "@/lib/launcher/scopes/parsers/check-is-native.ts";
import { parseLibrary } from "@/lib/launcher/scopes/parsers/parse-library.ts";
import { parseNative } from "@/lib/launcher/scopes/parsers/parse-native.ts";
import { shouldIncludeLibrary } from "@/lib/launcher/scopes/parsers/should-include-library.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/validators/shallowly-validate-library.ts";
import { log } from "@/lib/logging/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLibraries({
  patchUid,
  necessaries,
  libraries,
  isMaven,
}: {
  "patchUid"   : string;
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<SpecificPatchLibraryType>;
  "isMaven"    : boolean;
}): Array<MappedArtifactType> {
  const beforeHooksResult: "continue" | Array<MappedArtifactType> | undefined =
    Hooks.catchSyncResponseHooks<Array<MappedArtifactType>>({
      "scope" : "onLibrariesParsing",
      "toPass": { necessaries, libraries },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patchUid + ":" + logPrefix;
  const results: Array<MappedArtifactType> = [];

  log.debug(descriptiveLogPrefix, `Parsing ${libraries.length} libraries`);
  for (const entry of libraries) {
    const library: SpecificPatchLibraryType | false = shallowlyValidateLibrary({
      "library": entry,
      statuses,
      descriptiveLogPrefix,
    });

    if (library === false) {
      log.warn(
        descriptiveLogPrefix,
        `The '${JSON.stringify(entry)}' library is completely invalid`,
      );

      continue;
    }

    const toInclude: boolean = shouldIncludeLibrary({
      necessaries,
      library,
    });

    if (!toInclude) {
      continue;
    }

    const hasNative: boolean = checkIsNative(library);
    const artifact: MappedArtifactType | false = parseLibrary({
      necessaries,
      library,
      isMaven,
      patchUid,
    });

    if (artifact) {
      results.push(artifact);
    }

    if (hasNative) {
      const nativeArtifact: MappedArtifactType | false = parseNative({
        necessaries,
        library,
        patchUid,
      });

      if (nativeArtifact) {
        results.push(nativeArtifact);
      }
    }
  }

  const afterHooksResult: "continue" | Array<MappedArtifactType> | undefined =
    Hooks.catchSyncResponseHooks<Array<MappedArtifactType>>({
      "scope" : "onLibrariesParsing",
      "toPass": {
        necessaries,
        "unparsed": libraries,
        "parsed"  : results,
      },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.debug(
    descriptiveLogPrefix,
    `Got ${results.length}/${libraries.length} libraries`,
  );

  return results;
}

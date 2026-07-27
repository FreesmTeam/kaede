/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import FileStructure from "@/constants/file-structure.ts";
import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import { CustomPatches } from "@/constants/meta.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import FileManager from "@/lib/file-manager";
import Fetching from "@/lib/launcher/scopes/fetching";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolvePatch({
  necessaries,
  metadata,
  patchMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "metadata"   : PatchDependencyType;
  "patchMeta" ?: SpecificPatchMetaType;
}): Promise<SpecificPatchMetaType | false> {
  const beforeHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, patchMeta, metadata },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses, logPrefix } = necessaries;
  const version: string | false = await GlobalObject.libs.Launcher.Patches
    .resolvePatchVersion({ necessaries, metadata });
  const fileName: string = version + ".json";
  const descriptiveLogPrefix: string = metadata.uid + ":" + fileName + ":" + logPrefix;
  let parsedPatch: unknown;

  log.debug(descriptiveLogPrefix, "Reading the cached patch metadata");
  statuses.current = LaunchStatus.PatchMetadata.Reading;
  try {
    const refetch = async (): Promise<unknown> => {
      const url: string = metadata.uid === CustomPatches.OptiFine
        ? (
          APIEndpoints.KaedeCache.Base +
          APIEndpoints.KaedeCache.Paths.OptiFine.Base +
          fileName
        )
        : APIEndpoints.Meta.Base + metadata.uid + "/" + fileName;

      log.warn(
        descriptiveLogPrefix,
        "No cache; fetching the patch metadata",
      );
      statuses.current = LaunchStatus.PatchMetadata.Fetching;
      const fetched: { "data": unknown } | LaunchStatusType = await Fetching.fetchMetadata({
        "url"   : url,
        "label" : "patch metadata",
        "scope" : "PatchMetadata",
        "prefix": descriptiveLogPrefix,
      });

      // Just return the patch metadata
      if (typeof fetched === "object") {
        return fetched.data;
      }

      log.error(
        descriptiveLogPrefix,
        `Could not fetch the patch metadata. Status: ${fetched}`,
      );
      statuses.current = fetched;

      /*
       * The 'General#handleJsonFile' function writes the returned value
       * into the file specified earlier, but in case of an error we do not
       * want to write anything. Moreover, we want to stop the launch process execution
       * since we cannot handle a MultiMC patch without its metadata
       */
      throw new Error(`An error occurred while fetching the patch metadata (${metadata.uid})`);
    };

    parsedPatch = await FileManager.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Cache.Path, metadata.uid, fileName],
      "label"          : `/cache/${metadata.uid}/${fileName}`,
      "getDefaultValue": refetch,
      "invalidation"   : {
        "days"       : 7,
        "getNewValue": refetch,
      },
    });
  } catch (error: unknown) {
    log.error(
      descriptiveLogPrefix,
      "Caught an error while getting the patch metadata:",
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(descriptiveLogPrefix, "Validating the patch metadata");
  const validPatch: SpecificPatchMetaType | false = Schemas.validate.patchMeta({
    "value": parsedPatch,
    "label": "patch metadata",
    "info" : {
      "id": metadata.uid,
    },
  });

  if (validPatch === false) {
    log.error(descriptiveLogPrefix, "Invalid metadata");

    return false;
  }

  const afterHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, patchMeta, metadata },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.info(descriptiveLogPrefix, "Successful validation");

  return validPatch;
}

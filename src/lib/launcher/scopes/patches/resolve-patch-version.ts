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
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Fetching from "@/lib/launcher/scopes/fetching";
import { log } from "@/lib/logging/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function resolvePatchVersion({
  necessaries,
  metadata,
}: {
  "necessaries": PreLaunchInformationType;
  "metadata"   : PatchDependencyType;
}): Promise<string | false> {
  const { "user": { versions }, logPrefix } = necessaries;
  const selected: string | undefined = versions?.[metadata.uid];

  // Return the user selected version
  if (selected !== undefined) {
    return selected;
  }

  // 'requires' entry usually has a specified version
  const specified: string | undefined = metadata.equals ?? metadata.suggests;

  // Return the version suggested by metadata
  if (specified !== undefined) {
    return specified;
  }

  const { directories, statuses } = necessaries;
  const fileName: string = metadata.uid + ".json";
  let parsedPatchIndex: unknown;

  log.debug(logPrefix, "Reading the cached index manifest");
  statuses.current = LaunchStatus.PatchIndex.Reading;
  try {
    const refetch = async (): Promise<unknown> => {
      log.warn(
        logPrefix,
        "No cache; fetching the index manifest",
      );
      statuses.current = LaunchStatus.PatchIndex.Fetching;
      const fetched: { "data": unknown } | LaunchStatusType = await Fetching.fetchMetadata({
        "url"   : APIEndpoints.Meta.Base + metadata.uid,
        "label" : "index manifest",
        "scope" : "PatchIndex",
        "prefix": metadata.uid,
      });

      // Just return the patch index manifest
      if (typeof fetched === "object") {
        return fetched.data;
      }

      log.error(
        logPrefix,
        `Could not fetch the index manifest. Status: ${fetched}`,
      );
      statuses.current = fetched;

      /*
       * The 'General#handleJsonFile' function writes the returned value
       * into the file specified earlier, but in case of an error we do not
       * want to write anything. Moreover, we want to stop the launch process execution
       * since we cannot handle a MultiMC patch without the version
       */
      throw new Error(`An error occurred while fetching the index manifest (${metadata.uid})`);
    };

    parsedPatchIndex = await FileManager.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Cache.Path, fileName],
      "label"          : `/cache/${fileName}`,
      "getDefaultValue": refetch,
      "invalidation"   : {
        "days"       : 7,
        "getNewValue": refetch,
      },
    });
  } catch (error: unknown) {
    log.error(
      logPrefix,
      "Caught an error while getting the index manifest:",
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(logPrefix, "Validating the index manifest");

  if (
    // Ensure the index manifest is an object
    typeof parsedPatchIndex !== "object" ||
    parsedPatchIndex === null ||
    // Ensure the 'versions' field is a non-empty array
    !("versions" in parsedPatchIndex) ||
    !Array.isArray(parsedPatchIndex.versions) ||
    parsedPatchIndex.versions.length <= 0 ||
    // Ensure the provided 'versions' entry has a string typed 'version' field
    typeof parsedPatchIndex.versions[0] !== "object" ||
    parsedPatchIndex.versions[0] === null ||
    !("version" in parsedPatchIndex.versions[0]) ||
    typeof parsedPatchIndex.versions[0].version !== "string"
  ) {
    log.error(logPrefix, log.templates.json.contents(
      "Failed to shallowly validate the index manifest. Contents",
      parsedPatchIndex,
    ));
    statuses.current = LaunchStatus.PatchIndex.FailedToValidate;

    return false;
  }

  return parsedPatchIndex.versions[0].version;
}

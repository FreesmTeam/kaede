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
import { APIEndpoints, GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import General from "@/lib/general";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";
import { shallowlyValidateMeta } from "@/lib/launcher/scopes/validators/shallowly-validate-meta.ts";
import { verifyArtifacts } from "@/lib/launcher/scopes/validators/verify-artifacts.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { AssetObjectsType } from "@/types/launcher/artifacts/asset-objects.type.ts";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchAssetIndexType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadAssets({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const { directories, statuses, instance, logPrefix, cancelId } = necessaries;

  log.debug(logPrefix, "Getting the assetIndex metadata");
  if (
    finalizedPatch.assetIndex === undefined ||
    finalizedPatch.assetIndex?.id === undefined ||
    finalizedPatch.assetIndex?.url === undefined
  ) {
    log.error(logPrefix, "The finalized patch is missing assetIndex metadata");
    statuses.current = LaunchStatus.AssetIndex.FailedToGet;

    return false;
  }

  const assetIndex: SpecificPatchAssetIndexType = finalizedPatch.assetIndex;
  const metaFilename = assetIndex.id + ".json";
  let parsedIndex: unknown;

  log.debug(logPrefix, "Reading the cached assets metadata");
  statuses.current = LaunchStatus.AssetIndex.Reading;
  try {
    const refetch = async (): Promise<unknown> => {
      log.warn(logPrefix, "No cache; fetching the assets metadata");
      statuses.current = LaunchStatus.AssetIndex.Fetching;
      const fetched: { "data": unknown } | LaunchStatusType = await fetchMetadata({
        "url"   : assetIndex.url,
        "label" : "assets index",
        "scope" : "AssetIndex",
        "prefix": metaFilename,
      });

      // Just return the assets index
      if (typeof fetched === "object") {
        return fetched.data;
      }

      log.error(
        logPrefix,
        `Could not fetch the asset index. Status: ${fetched}`,
      );
      statuses.current = fetched;

      /*
       * The 'General#handleJsonFile' function writes the returned value
       * into the file specified earlier, but in case of an error we do not
       * want to write anything
       */
      throw new Error(`An error occurred while fetching the asset index (${metaFilename})`);
    };

    parsedIndex = await FileManager.handleJsonFile({
      "baseDirectory": directories.base,
      "path"         : [
        FileStructure.Folders.Assets.Path,
        FileStructure.Folders.Assets.Folders.Indexes.Path,
        metaFilename,
      ],
      "label"          : `/assets/indexes/${metaFilename}`,
      "getDefaultValue": refetch,
      "invalidation"   : {
        "days"       : 7,
        "getNewValue": refetch,
      },
    });
  } catch (error: unknown) {
    log.error(
      logPrefix,
      `${metaFilename} | Caught an error while getting the asset index:`,
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(logPrefix, "Validating the assets metadata");
  const shallowlyValidIndex: AssetObjectsType | false = shallowlyValidateMeta({
    "meta": parsedIndex,
  });

  if (shallowlyValidIndex === false) {
    log.error(__PRE_BUNDLED_FILENAME__, "The assets index is invalid");
    statuses.current = LaunchStatus.AssetIndex.FailedToValidate;

    return false;
  }

  const mappedAssetObjects: Array<{
    "shortHashPath": string;
    "hash"         : string;
    "url"          : string;
    "path"         : string;
  }> = Object
    .values(shallowlyValidIndex.objects)
    .map(({ hash }) => {
      const shortHash = hash.slice(0, 2);
      const url = APIEndpoints.Resources.Base + shortHash + "/" + hash;
      const shortHashPath = General.cachedJoin(
        directories.assetObjects,
        shortHash,
      );
      const filePath = General.cachedJoin(
        shortHashPath,
        hash,
      );

      return {
        shortHashPath,
        hash,
        url,
        "path": filePath,
      };
    });

  log.debug(
    logPrefix,
    `Verifying ${mappedAssetObjects.length} assets for their existence.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );
  const startTime: number = performance.now();
  const hashesToReDownload: Set<string> = new Set(
    await verifyArtifacts({
      "paths"   : mappedAssetObjects,
      "checksum": instance.checksum,
    }),
  );
  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    logPrefix,
    `Successfully verified ${mappedAssetObjects.length} assets in ${totalTime} ms.`,
    `Total mismatches: ${hashesToReDownload.size}.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );

  const missingAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "path"         : string;
  }> = mappedAssetObjects.filter(({ path }) => {
    return hashesToReDownload.has(path);
  });

  const report = await General.concurrentlyDownload({
    statuses,
    cancelId,
    "concurrency": GeneralSettings.ConcurrentDownloads.Assets,
    "entries"    : missingAssetObjects,
    "label"      : "assets",
  });

  if (report.cancelled) {
    return false;
  }

  log.info(
    logPrefix,
    `Successfully handled ${mappedAssetObjects.length} assets`,
    `and re-downloaded ${hashesToReDownload.size} of them`,
  );
  statuses.current = LaunchStatus.AssetObjects.Success;

  return true;
}

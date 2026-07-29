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

import Launcher from "@/lib/launcher";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import Validators from "@/lib/launcher/scopes/validators";
import { log } from "@/lib/logging/log.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const failed: LaunchResponseType = {
  "success": false,
  "process": undefined,
};

export async function handleLaunch({
  instanceId,
  instance,
  statuses,
  userPreferences,
  onClose,
  onInput,
}: {
  "instanceId"     : string;
  "instance"       : InstanceStateType;
  "statuses"       : LauncherStatusesType;
  "userPreferences": PreLaunchInformationType["user"];
  "onClose"        : (instanceId: string) => void;
  "onInput"        : (line: string) => void;
}): Promise<LaunchResponseType> {
  const logPrefix: string = `${instanceId}:${__PRE_BUNDLED_FILENAME__}`;
  const necessaries: PreLaunchInformationType | false = Extractors.getNecessaries({
    instanceId,
    instance,
    statuses,
    userPreferences,
    logPrefix,
  });

  // Same as 'necessaries.logPrefix'
  log.info(logPrefix, log.templates.json.contents(
    "Pre-launch information contents",
    necessaries,
  ));

  if (necessaries === false) {
    log.warn(
      // Same as 'necessaries.logPrefix'
      logPrefix,
      "Aborting the launch process due to an error in pre-launch information extraction",
    );

    return failed;
  }

  await Promise.all([
    Validators.ensurePatchDirectories(necessaries),
    Validators.ensureMinecraftDirectory(necessaries),
    Validators.initializeAssetsDirectories(necessaries),
  ]);

  const entryPatch: SpecificPatchMetaType | false = await Patches.resolvePatch({
    necessaries,
    "metadata": {
      "uid": instance.entry,
    },
  });

  if (entryPatch === false) {
    log.warn(
      necessaries.logPrefix,
      "Aborting the launch process due to an error in entry patch resolving",
    );

    return failed;
  }

  const allPatches: Array<SpecificPatchMetaType> = await Patches.resolveSubPatches({
    "patchMeta": entryPatch,
    necessaries,
  });
  const finalizedPatch: FinalizedPatchType = Parsers.finalizePatches({
    "patches": allPatches,
    necessaries,
  });

  log.info(necessaries.logPrefix, log.templates.json.contents(
    "Finalized patch contents",
    {
      ...finalizedPatch,
      "artifacts": "[ ... ] (" + finalizedPatch.artifacts.length + " entries)",
    },
  ));

  const responses: Array<boolean> = await Promise.all([
    Fetching.downloadAssets({ necessaries, finalizedPatch }),
    Fetching.downloadClient({ necessaries, finalizedPatch }),
    Fetching.downloadLogging({ necessaries, finalizedPatch }),
    Fetching
      .downloadLibraries({ necessaries, finalizedPatch })
      .then(async result => {
        if (!result) {
          return false;
        }

        await Extractors.unzipNatives({
          necessaries,
          "paths": finalizedPatch
            .artifacts
            .filter(({ status }) => status === "native")
            .map(({ path, exclude }) => ({ path, "exclude": exclude ?? [] })),
        });

        return true;
      }),
  ]);

  for (const status of responses) {
    if (!status) {
      log.warn(
        necessaries.logPrefix,
        "Aborting the launch process due to an error in artifact downloads",
      );

      return failed;
    }
  }

  const command: {
    "java"     : string;
    "arguments": Array<string>;
  } = await Launcher.createCommand({ necessaries, finalizedPatch });

  return Launcher.spawnMinecraft({
    command,
    instanceId,
    necessaries,
    onClose,
    onInput,
  });
}

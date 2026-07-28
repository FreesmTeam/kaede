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
import { LaunchStatus } from "@/constants/launcher.ts";
import { Host } from "@/lib/capability-broker";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import Instances from "@/lib/instances";
import {
  getDownloadCancelId,
} from "@/lib/launcher/scopes/fetching/get-download-cancel-id.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export function extractPreLaunchInformation({
  statuses,
  instance,
  instanceId,
  userPreferences,
  logPrefix,
}: {
  "statuses"       : LauncherStatusesType;
  "instance"       : InstanceStateType;
  "instanceId"     : string;
  "userPreferences": PreLaunchInformationType["user"];
  "logPrefix"      : string;
}): PreLaunchInformationType | false {
  const beforeHooksResult: "continue" | PreLaunchInformationType | false | undefined =
    ExtensionsManager.catchSyncResponseHooks<PreLaunchInformationType | false>({
      "scope" : "onPreLaunchInformation",
      "toPass": { statuses, instanceId },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const downloadTaskCancelId: string = getDownloadCancelId(instanceId);
  const { "platform": providedPlatform, "arch": providedArch } =
    Host.runtime.getCachedSnapshot().os;

  let compatiblePlatform: PreLaunchInformationType["platform"];
  let compatibleArch: PreLaunchInformationType["arch"];

  const baseDirectory: string = General.getCachedBaseDirectory();
  const instanceDirectory: string = Instances.getMinecraftDirectory({
    baseDirectory,
    instanceId,
  });
  const assetsDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
  );
  const loggingDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
    FileStructure.Folders.Assets.Folders.LogConfigs.Path,
  );
  const librariesDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Libraries.Path,
  );
  const nativesDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
    FileStructure.Folders.Instances.Folders._Entry_.Folders.Natives.Path,
  );

  switch (providedPlatform) {
    case "linux":
    case "windows":
    case "macos": {
      compatiblePlatform = providedPlatform;

      break;
    }
    default: {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `The provided platform (${providedPlatform}) is incompatible`,
      );
      statuses.current = LaunchStatus.Errors.IncompatiblePlatform;

      return false;
    }
  }

  switch (providedArch) {
    case "x86": {
      compatibleArch = "x86";

      break;
    }
    case "x86_64": {
      compatibleArch = "x64";

      break;
    }
    case "arm": {
      compatibleArch = "arm32";

      break;
    }
    case "aarch64":
    case "riscv64": {
      compatibleArch = "arm64";

      break;
    }
    default: {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `The provided arch (${providedArch}) is incompatible`,
      );
      statuses.current = LaunchStatus.Errors.IncompatibleArch;

      return false;
    }
  }

  const preLaunchInformation: PreLaunchInformationType = {
    "logPrefix"  : logPrefix,
    "statuses"   : statuses,
    "platform"   : compatiblePlatform,
    "arch"       : compatibleArch,
    "instance"   : instance,
    "user"       : userPreferences,
    "cancelId"   : downloadTaskCancelId,
    "directories": {
      "base"        : baseDirectory,
      "instance"    : instanceDirectory,
      "assets"      : assetsDirectory,
      "logging"     : loggingDirectory,
      "libraries"   : librariesDirectory,
      "natives"     : nativesDirectory,
      "assetIndexes": General.cachedJoin(
        assetsDirectory,
        FileStructure.Folders.Assets.Folders.Indexes.Path,
      ),
      "assetObjects": General.cachedJoin(
        assetsDirectory,
        FileStructure.Folders.Assets.Folders.Objects.Path,
      ),
    },
  };

  const afterHooksResult: "continue" | PreLaunchInformationType | false | undefined =
    ExtensionsManager.catchSyncResponseHooks<PreLaunchInformationType | false>({
      "scope" : "onPreLaunchInformation",
      "toPass": preLaunchInformation,
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return preLaunchInformation;
}

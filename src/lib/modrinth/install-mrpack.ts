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

import { invoke } from "@tauri-apps/api/core";

import { GeneralSettings } from "@/constants/launcher.ts";
import { MrpackDependencies } from "@/constants/modrinth.ts";
import FileManager from "@/lib/file-manager";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Network from "@/lib/network";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

export function resolvePatchVersions(
  dependencies: MrpackManifestType["dependencies"],
): InstanceStateType["patchVersions"] | undefined {
  const minecraft: string | undefined = dependencies.minecraft;

  if (minecraft === undefined) {
    return undefined;
  }

  const patchVersions: InstanceStateType["patchVersions"] = {
    "net.minecraft": minecraft,
  };

  for (const [key, version] of Object.entries(dependencies)) {
    const uid = MrpackDependencies[key];

    if (uid !== undefined) {
      patchVersions[uid] = version;
    }
  }

  return patchVersions;
}

export async function peekMrpack(archivePath: string): Promise<MrpackManifestType | undefined> {
  const manifest = await invoke<MrpackManifestType | null>("peek_mrpack", {
    archivePath,
  });

  return manifest ?? undefined;
}

export async function installMrpack({
  archivePath,
  instanceId,
  statuses,
}: {
  "archivePath": string;
  "instanceId" : string;
  "statuses"   : LauncherStatusesType;
}): Promise<MrpackManifestType | undefined> {
  const { instanceDirectory } = Instances.getMinecraftDirectory({
    "baseDirectory": FileManager.getBaseDirectory(),
    instanceId,
  });

  const manifest = await invoke<MrpackManifestType>("install_mrpack", {
    archivePath,
    "targetDirPath": instanceDirectory,
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Extracted ${manifest.overrides} overrides of '${manifest.name}'`,
    `(${manifest.versionId}) and indexed ${manifest.files.length} files`,
  );

  const entries: Array<{ "url": string; "path": string }> = manifest
    .files
    .map(({ path, url }) => ({
      url,
      "path": FileManager.join(instanceDirectory, path),
    }));

  const report = await Network.concurrentlyDownload({
    statuses,
    entries,
    "concurrency": GeneralSettings.ConcurrentDownloads.Libraries,
    "label"      : "modrinth modpack",
    "cancelId"   : instanceId,
  });

  if (report.cancelled) {
    log.info(__PRE_BUNDLED_FILENAME__, `Cancelled installing '${manifest.name}'`);

    return undefined;
  }

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Installed '${manifest.name}' (${manifest.versionId}):`,
    `${report.success} succeeded, ${report.failed} failed`,
  );

  return manifest;
}

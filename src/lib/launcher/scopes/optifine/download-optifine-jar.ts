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

import { exists } from "@tauri-apps/plugin-fs";

import { APIEndpoints } from "@/constants/launcher.ts";
import FileManager from "@/lib/file-manager";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { log } from "@/lib/logging/log.ts";
import Network from "@/lib/network";
import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { ParsedOptiFineVersionType } from "@/types/launcher/optifine/parsed-version.type.ts";

export function getOptiFineArtifactName(version: string): string {
  return `optifine:OptiFine:${version}`;
}

// Example: 'https://bmclapi2.bangbang93.com/optifine/1.8.9/HD_U/M5'
export function getOptiFineDownloadUrl(parsed: ParsedOptiFineVersionType): string {
  return (
    APIEndpoints.BMCLAPI.Base +
    APIEndpoints.BMCLAPI.Paths.OptiFine.Base +
    `${parsed.minecraftVersion}/${parsed.type}/${parsed.patch}`
  );
}

export async function downloadOptiFineJar({
  parsed,
  version,
  librariesDirectory,
  statuses,
  cancelId,
  label,
}: {
  "parsed"            : ParsedOptiFineVersionType;
  "version"           : string;
  "librariesDirectory": string;
  "statuses"          : LauncherStatusesType;
  "cancelId"          : string;
  "label"             : string;
}): Promise<string | false> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  const { "directory": relativeDirectory, file } = normalizeArtifactPath(
    getOptiFineArtifactName(version),
  );
  const directory: string = FileManager.join(librariesDirectory, relativeDirectory);
  const path     : string = FileManager.join(directory, file);

  if (await exists(path)) {
    log.debug(logPrefix, `The OptiFine jar is already downloaded (${path})`);

    return path;
  }

  // Example: 'https://bmclapi2.bangbang93.com/optifine/1.8.9/HD_U/M5'
  const url: string = getOptiFineDownloadUrl(parsed);

  log.info(logPrefix, `Downloading the OptiFine jar from ${url}`);

  const report: DownloadReportType = await Network.concurrentlyDownload({
    "concurrency": 1,
    "entries"    : [{ url, path }],
    "label"      : "optifine",
    statuses,
    cancelId,
  });

  if (report.cancelled) {
    log.warn(logPrefix, "The OptiFine download was cancelled");

    return false;
  }

  if (report.failed > 0) {
    log.error(
      logPrefix,
      "Failed to download the OptiFine jar:",
      report.failures.map(({ error }) => error).join("; "),
    );

    return false;
  }

  log.info(logPrefix, `Downloaded the OptiFine jar to ${path}`);

  return path;
}

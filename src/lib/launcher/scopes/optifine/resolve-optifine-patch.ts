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

import {
  downloadOptiFineJar,
  getOptiFineDownloadUrl,
} from "@/lib/launcher/scopes/optifine/download-optifine-jar.ts";
import {
  extractLaunchWrapper,
} from "@/lib/launcher/scopes/optifine/extract-launchwrapper.ts";
import {
  generateOptiFinePatch,
} from "@/lib/launcher/scopes/optifine/generate-optifine-patch.ts";
import {
  inspectOptiFineJar,
} from "@/lib/launcher/scopes/optifine/inspect-optifine-jar.ts";
import {
  parseOptiFineVersion,
} from "@/lib/launcher/scopes/optifine/parse-optifine-version.ts";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { InspectedOptiFineJarType } from "@/types/launcher/optifine/inspected-jar.type.ts";
import type { ParsedOptiFineVersionType } from "@/types/launcher/optifine/parsed-version.type.ts";

// We are essentially going from manual patches to automatically generated ones
export async function resolveOptiFinePatch({
  necessaries,
  version,
}: {
  "necessaries": PreLaunchInformationType;
  "version"    : string;
}): Promise<Record<string, unknown> | false> {
  const { directories, statuses, cancelId, logPrefix } = necessaries;
  const label: string = `optifine:${version}:${logPrefix}`;
  const descriptiveLogPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  const parsed: ParsedOptiFineVersionType | false = parseOptiFineVersion(version);

  if (parsed === false) {
    log.error(descriptiveLogPrefix, `Could not parse the '${version}' OptiFine version`);

    return false;
  }

  const jarPath: string | false = await downloadOptiFineJar({
    parsed,
    version,
    "librariesDirectory": directories.libraries,
    statuses,
    cancelId,
    label,
  });

  if (jarPath === false) {
    return false;
  }

  /*
   * A missing bundled LaunchWrapper is okay since some old OptiFine
   * '.jar' files relied on a vanilla LaunchWrapper
   */
  const bundled: InspectedOptiFineJarType | false = await inspectOptiFineJar({ jarPath, label });
  let launchWrapper: { "name": string; "path": string } | false = false;

  if (bundled !== false) {
    const extractedPath: string | false = await extractLaunchWrapper({
      jarPath,
      "librariesDirectory": directories.libraries,
      bundled,
      label,
    });

    if (extractedPath === false) {
      return false;
    }

    launchWrapper = {
      "name": `net.minecraft:launchwrapper:of-${bundled.version}`,
      "path": extractedPath,
    };
  }

  return generateOptiFinePatch({
    version,
    "minecraftVersion": parsed.minecraftVersion,
    "optiFineJarPath" : jarPath,
    "optiFineUrl"     : getOptiFineDownloadUrl(parsed),
    launchWrapper,
    label,
  });
}

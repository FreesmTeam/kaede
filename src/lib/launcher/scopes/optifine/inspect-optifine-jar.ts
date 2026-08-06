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

import { log } from "@/lib/logging/log.ts";
import type { InspectedOptiFineJarType } from "@/types/launcher/optifine/inspected-jar.type.ts";

/*
 * It seems like every OptiFine '.jar' files has LaunchWrapper inside,
 * and 'launchwrapper-of.txt' stores the version of that LaunchWrapper
 */
const versionEntry: string = "launchwrapper-of.txt";

export async function inspectOptiFineJar({
  jarPath,
  label,
}: {
  "jarPath": string;
  "label"  : string;
}): Promise<InspectedOptiFineJarType | false> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  const contents = await invoke<Array<number> | null>("read_archive_entry", {
    "archivePath": jarPath,
    "entryPath"  : versionEntry,
  }).catch((error: unknown) => {
    log.error(logPrefix, `Failed to read '${versionEntry}': ${String(error)}`);

    return null;
  });

  // Well, some old OptiFine files rely on a vanilla 'net.minecraft:launchwrapper'
  if (contents === null) {
    log.warn(
      logPrefix,
      `No '${versionEntry}' entry; relying on a vanilla LaunchWrapper`,
    );

    return false;
  }

  const decoder = new TextDecoder;
  const version: string = decoder
    .decode(new Uint8Array(contents))
    .trim();

  if (!version) {
    log.warn(logPrefix, `The '${versionEntry}' entry is empty`);

    return false;
  }

  const entryPath: string = `launchwrapper-of-${version}.jar`;

  log.debug(logPrefix, `Found the bundled LaunchWrapper version: ${version}`);

  return { version, entryPath };
}

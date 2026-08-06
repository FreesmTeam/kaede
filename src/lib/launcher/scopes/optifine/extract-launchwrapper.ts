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
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";

import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import type { InspectedOptiFineJarType } from "@/types/launcher/optifine/inspected-jar.type.ts";

/*
 * Extracts the LaunchWrapper jar and puts it into 'libaries/',
 * and that's why it's time to implement the 'MMC-hint' support lol
 */
export async function extractLaunchWrapper({
  jarPath,
  librariesDirectory,
  bundled,
  label,
}: {
  "jarPath"           : string;
  "librariesDirectory": string;
  "bundled"           : InspectedOptiFineJarType;
  "label"             : string;
}): Promise<string | false> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  const directory: string = FileManager.join(
    librariesDirectory,
    "net",
    "minecraft",
    "launchwrapper",
    `of-${bundled.version}`,
  );
  const path: string = FileManager.join(directory, `launchwrapper-of-${bundled.version}.jar`);
  const pathExists: boolean = await exists(path);

  if (pathExists) {
    log.debug(logPrefix, `The bundled LaunchWrapper is already extracted (${path})`);

    return path;
  }

  const contents = await invoke<Array<number> | null>("read_archive_entry", {
    "archivePath": jarPath,
    "entryPath"  : bundled.entryPath,
  }).catch((error: unknown) => {
    log.error(logPrefix, `Failed to read '${bundled.entryPath}': ${String(error)}`);

    return null;
  });

  if (contents === null) {
    log.error(logPrefix, `The '${bundled.entryPath}' entry is missing from ${jarPath}`);

    return false;
  }

  try {
    await mkdir(directory, { "recursive": true });
    await writeFile(path, new Uint8Array(contents));

    log.info(
      logPrefix,
      `Extracted the bundled LaunchWrapper ${bundled.version} (${contents.length} bytes)`,
    );
  } catch (error) {
    log.error(logPrefix, `Failed to write the LaunchWrapper jar: ${String(error)}`);

    return false;
  }

  return path;
}

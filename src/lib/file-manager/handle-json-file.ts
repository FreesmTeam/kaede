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
  exists,
  type FileInfo,
  readTextFile,
  stat,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

import Errors from "@/lib/errors";
import General from "@/lib/general";
import { cachedJoin } from "@/lib/general/scopes/cached-join.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function handleJsonFile({
  baseDirectory,
  path,
  label,
  getDefaultValue,
  invalidation,
}: {
  "baseDirectory"  : string;
  "path"           : Array<string>;
  "label"          : string;
  "getDefaultValue": () => Promise<unknown>;
  "invalidation"  ?: {
    "days"       : number;
    "getNewValue": () => Promise<unknown>;
  };
}): Promise<unknown> {
  const filePath: string = cachedJoin(baseDirectory, ...path);
  const overwrite: (toWrite: unknown) => Promise<unknown> = async toWrite => {
    await writeTextFile(
      filePath,
      // 'toWrite' might be undefined, and JSON does not support undefined
      JSON.stringify(toWrite ?? null, null, 2),
    );

    return toWrite;
  };

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, `Checking if the '${label}' file exists`);
    const fileExists: boolean = await exists(filePath).catch(() => false);

    if (!fileExists) {
      log.warn(__PRE_BUNDLED_FILENAME__, `The '${label}' file does not exist`);
      log.debug(__PRE_BUNDLED_FILENAME__, `Getting the default value for '${label}'`);
      const defaultValue = await getDefaultValue();

      log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${label}' file`);

      return await overwrite(defaultValue);
    }

    if (invalidation !== undefined) {
      log.debug(__PRE_BUNDLED_FILENAME__, `Checking if '${label}' needs cache invalidation`);
      const fileInfo: FileInfo = await stat(filePath);
      const lastModified: Date | null = fileInfo.mtime;
      // No last modified time = invalid
      let invalid: boolean = lastModified === null;

      if (lastModified) {
        const difference: number = General.checkDaysDifference(lastModified, (new Date));

        // Stale = invalid
        invalid = difference > invalidation.days;
      }

      if (invalid) {
        const newValue = await invalidation.getNewValue();

        return await overwrite(newValue);
      }
    }

    log.debug(__PRE_BUNDLED_FILENAME__, `Reading the '${label}' file`);
    const storedFileData: string = await readTextFile(filePath);
    let parsed: unknown;

    try {
      log.debug(__PRE_BUNDLED_FILENAME__, `Parsing the '${label}' file`);
      parsed = JSON.parse(storedFileData);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Could not parse the '${label}' file data:`,
        Errors.prettify(error),
      );
      log.debug(__PRE_BUNDLED_FILENAME__, `Returning the default value for '${label}'`);
      const defaultValue = await getDefaultValue();

      return await overwrite(defaultValue);
    }

    log.debug(__PRE_BUNDLED_FILENAME__, `Returning the parsed '${label}' file`);

    return parsed;
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not handle the '${label}' JSON file:`,
      Errors.prettify(error),
    );

    /*
     * All async functions in the 'try' body were awaited,
     * so no bubbling up should happen. However, here we do not care
     * about it
     */
    return getDefaultValue();
  }
}

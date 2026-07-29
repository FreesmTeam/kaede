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

import { FamousAndOldJavaMajorVersion } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import { runProcess } from "@/lib/processes/run-process.ts";
import type { RunResultType } from "@/types/application/server-process.type.ts";

export async function fetchJavaMajor(): Promise<number> {
  let result: RunResultType;

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting the Java version");
    result = await runProcess({
      "program": { "type": "path", "value": "java" },
      "args"   : [
        // The '--version' argument does not work in Java 8 and older
        "-version",
      ],
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not get the Java version output:",
      Errors.prettify(error),
    );

    return FamousAndOldJavaMajorVersion;
  }

  /*
   * The output format is similar to this:
   * openjdk version "25.0.1" 2025-10-21 LTS
   *
   * Also, seems like the output is written into 'stderr' instead of 'stdout'
   * while the 'stdout' part remains an empty string
   */
  const output: string = result.stdout || result.stderr;
  const parsed: Array<string> = output.split("\"");
  const possibleVersion: string | undefined = parsed?.[1];

  if (!possibleVersion) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not parse the Java major version. The original output:",
      output,
    );

    return FamousAndOldJavaMajorVersion;
  }

  const majorVersion: number = Number(
    possibleVersion.split(".")?.[0],
  );

  if (Number.isNaN(majorVersion)) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The parsed Java major version is not a number. The original output:",
      output,
    );

    return FamousAndOldJavaMajorVersion;
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "The current Java major version is:",
    majorVersion.toString(),
  );

  return majorVersion;
}

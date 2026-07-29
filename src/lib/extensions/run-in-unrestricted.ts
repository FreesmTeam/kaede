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

import { AsyncFunction } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import ExtensionAPI from "@/lib/extension-api";
import { log } from "@/lib/logging/log.ts";

export async function runInUnrestricted(id: string, code: string): Promise<ExtensionAPI | void> {
  const startTime = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${id}' extension code`);

  const compiled = new AsyncFunction("scopedThis", "Kaede", code);
  const scopedThis = {
    "Kaede": new ExtensionAPI(id),
  };

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Executing the '${id}' extension code in the unrestricted environment`,
  );
  try {
    await compiled(scopedThis, scopedThis.Kaede);
  } catch (error: unknown) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to execute the '${id}' extension code in the unrestricted environment:`,
      Errors.prettify(error),
    );
  }

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${id}' plugin was successfully executed in ${timeDifference} ms`,
  );

  return scopedThis.Kaede;
}

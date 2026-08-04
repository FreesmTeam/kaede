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

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type { extensionStates } from "@/states/extension.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type ExecutedListType = (typeof extensionStates)["executed"];

export async function dirtyLifecycle(
  executedList: ExecutedListType,
  { id, sha256, metadata }: ExtensionType,
  enable: boolean,
  // Represents 'needsCleanRun'
): Promise<boolean> {
  const existing = executedList.find(searching => (
    searching.extension.sha256 === sha256 &&

    /*
     * Just to be sure... Maybe there will be extensions that can work in both environments
     * with the same code
     */
    searching.extension.metadata.type === metadata.type
  ));
  const status = enable ? "Re-enabling" : "Disabling";

  if (existing !== undefined) {
    try {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        `${status} extension '${id}' (sha256: ${sha256})`,
      );
      await (
        enable
          ? existing.api.enable()
          : existing.api.disable()
      );

      log.info(
        __PRE_BUNDLED_FILENAME__,
        `Successfully finished ${status.toLowerCase()} extension '${id}' (sha256: ${sha256})`,
      );
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while ${status.toLowerCase()} extension '${id}' (sha256: ${sha256}):`,
        Errors.prettify(error),
      );
    }

    /*
     * Even if 'api#enable' threw an error, we still assume that the extension was re-enabled.
     * User can check errors in the log viewer. For clean runs, an error should be treated as fatal,
     * because clean enables initialize everything from scratch, and dirty enables generally
     * simply re-attach the event listeners and DOM
     */
    return false;
  }

  return true;
}

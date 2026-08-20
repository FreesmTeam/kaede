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

import { fetch } from "@tauri-apps/plugin-http";

import { TrustedHashesURL } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import { trustedExtensionHashes } from "@/states/extension.ts";

export async function updateTrustedHashes(): Promise<void> {
  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Fetching the trusted hashes...");

    const response: Response = await fetch(TrustedHashesURL);
    const data: Array<string> = await response.json();

    trustedExtensionHashes.value = new Set(data);

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Successfully updated trusted hashes. Total:",
      trustedExtensionHashes.value.size.toString(),
    );
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "An error occurred while updating trusted hashes:",
      Errors.prettify(error),
    );
  }
}

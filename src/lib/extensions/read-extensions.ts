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

import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type ReadExtensionsType = {
  "extensions": Array<{
    "fileName": string;
    "metadata": unknown;
    "code"    : string;
  }>;
  "failures": Array<{
    "fileName": string;
    "error"   : string;
  }>;
};

export async function readExtensions(): Promise<Array<ExtensionType>> {
  const result = await invoke<ReadExtensionsType | string>("read_extensions");

  if (typeof result === "string") {
    throw new TypeError(result);
  }

  const { extensions, failures } = result;

  for (const failure of failures) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `An error occurred while reading extension '${failure.fileName}':`,
      failure.error,
    );
  }

  const validated: Array<ExtensionType> = [];

  for (const [index, extension] of extensions.entries()) {
    const parts = extension.fileName.split(".");

    // Remove the '.kaede' or '.zip' part
    parts.pop();

    const id = parts.join(".");
    const valid: ExtensionType["metadata"] | false = Schemas.validate.extension({
      "value": extension.metadata,
      "label": "extension metadata",
      "info" : {
        "id"   : id,
        "index": index,
      },
    });

    if (valid !== false) {
      validated.push({ id, "code": extension.code, "metadata": valid });
    }
  }

  return validated;
}

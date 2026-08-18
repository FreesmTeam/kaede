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
import type { DeepPartial } from "unocss";

import FileStructure from "@/constants/file-structure.ts";
import { PermissionsList } from "@/constants/permissions.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type ReadExtensionsType = {
  "extensions": Array<{
    "fileName"  : string;
    "metadata"  : unknown;
    "codeSha256": string;
    "code"      : string;
  }>;
  "failures": Array<{
    "fileName": string;
    "error"   : string;
  }>;
};

export async function readExtensions(): Promise<{
  "valid"  : Array<ExtensionType>;
  "invalid": Array<DeepPartial<ExtensionType>>;
}> {
  const directory = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Extensions.Path,
  );
  const result = await invoke<ReadExtensionsType | string>("read_extensions", {
    "extensionsDirPath": directory,
  });

  if (typeof result === "string") {
    throw new TypeError(result);
  }

  const invalid: Array<DeepPartial<ExtensionType>> = [];
  const { extensions, failures } = result;

  for (const failure of failures) {
    const parts = failure.fileName.split(".");

    // Remove the '.kaede' or '.zip' part
    parts.pop();

    const id = parts.join(".");

    log.error(
      __PRE_BUNDLED_FILENAME__,
      `An error occurred while reading extension '${id}':`,
      failure.error,
    );

    invalid.push({ id });
  }

  const validated: Array<ExtensionType> = [];

  for (const [index, extension] of extensions.entries()) {
    const parts = extension.fileName.split(".");

    // Remove the '.kaede' or '.zip' part
    parts.pop();

    const id = parts.join(".");
    // It does not, however, validate permissions precisely
    const valid: ExtensionType["metadata"] | false = Schemas.validate.extension({
      "value": extension.metadata,
      "label": "extension metadata",
      "info" : {
        "id"   : id,
        "index": index,
      },
    });
    // Set to true by default since 'permissions' is an optional field
    let permissionsValid: boolean = true;

    // The permissions are validated precisely here
    if (valid && valid.permissions) {
      for (const permission of valid.permissions) {
        const currentValid: boolean = PermissionsList

          /*
           * Comparing permissions with '::' suffix to prevent 'time::performanceLOL' to be allowed
           * while the valid one is 'time::performance' (remember: 'base::scope::argument').
           *
           * 'time::performance::' will pass, though, but it should be okay
           * since we split the permission by '::'
           */
          .some(existing => `${permission}::`.startsWith(`${existing}::`));

        if (!currentValid) {
          permissionsValid = false;

          break;
        }
      }
    }

    if (valid && permissionsValid) {
      validated.push({
        id,
        "code"    : extension.code,
        "sha256"  : extension.codeSha256,
        "metadata": valid,
      });
    } else {
      invalid.push({
        id,
        "code"    : extension.code,
        "metadata": typeof extension.metadata === "object"
          ? { ...extension.metadata }
          : undefined,
      });
    }
  }

  return { "valid": validated, invalid };
}

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

import FileStructure from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";
import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getMain(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<ConfigType> {
  const baseDirectory: string = properties?.baseDirectory ?? FileManager.getBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;
  const configFileDirectory = FileManager.join(baseDirectory, FileStructure.Files.Config);

  const hooksResult: "continue" | ConfigType | undefined =
    await Hooks.catchAsyncResponseHooks<ConfigType>({
      "scope" : "onConfigFileGet",
      "toPass": configFileDirectory,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    return hooksResult;
  }

  if (parsedFile?.status === "corrupt") {
    return regenerateConfigFile({
      baseDirectory,
      configFileDirectory,
    });
  }

  const parsedConfig: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await FileManager.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Files.Config],
      "label"          : FileStructure.Files.Config,
      "getDefaultValue": getDefaultConfig,
    });

  const configId: string =
    [
      "[(keys)",
      Object
        .getOwnPropertyNames(parsedConfig)
        .join(", "),
      "]",
    ].join(" ");
  const config: ConfigType | false = Schemas.validate.config({
    "value": parsedConfig,
    "label": "config file",
    "info" : {
      "id": configId,
    },
  });

  if (config === false) {
    return regenerateConfigFile({
      baseDirectory,
      configFileDirectory,
    });
  }

  return config;
}

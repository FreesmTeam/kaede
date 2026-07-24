import FileStructure from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/initial-state.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getConfigFile(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<ConfigType> {
  const baseDirectory: string = properties?.baseDirectory ?? General.getCachedBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;
  const configFileDirectory = General.cachedJoin(baseDirectory, FileStructure.Files.Config);

  const hooksResult: "continue" | ConfigType | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<ConfigType>({
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
    : await General.handleJsonFile({
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

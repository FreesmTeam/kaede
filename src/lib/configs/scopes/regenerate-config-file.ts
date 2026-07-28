import { Host } from "@/lib/capability-broker";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function regenerateConfigFile({
  baseDirectory,
  configFileDirectory,
}: {
  "baseDirectory"      : string;
  "configFileDirectory": string;
}): Promise<ConfigType> {
  log.warn(__PRE_BUNDLED_FILENAME__, "Config file is invalid");
  log.debug(__PRE_BUNDLED_FILENAME__, "Renaming the invalid config file");
  const currentTimestamp: string = Date.now().toString();

  await Host.files.rename({
    "from": configFileDirectory,
    "to"  : General.cachedJoin(
      baseDirectory,
      "config_invalid_" + currentTimestamp + ".json",
    ),
  });

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing a new config file with default values");
  await initializeConfigFile(configFileDirectory);

  log.debug(__PRE_BUNDLED_FILENAME__, "Returning a promise with default config");

  // Awaiting here will just be an unnecessary action
  return getDefaultConfig();
}

import { Host } from "@/lib/capability-broker";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeConfigFile(configFilePath: string): Promise<void> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Getting default config");
  const defaultConfig = await getDefaultConfig();

  log.debug(__PRE_BUNDLED_FILENAME__, "Writing the default config file");
  await Host.files.writeText(configFilePath, JSON.stringify(
    defaultConfig,
    // Save formatting
    null,
    // With two spaces as an indent
    2,
  ));
}

import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ParsedFile } from "@/types/application/initial-state.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getSafeConfigFile(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<ConfigType> {
  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting a config file");

    // Await here to catch errors
    return await GlobalObject.libs.Configs.get(properties);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to get a config file:",
      Errors.prettify(error),
    );
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting a default config");

    return GlobalObject.libs.Configs.getDefault();
  }
}

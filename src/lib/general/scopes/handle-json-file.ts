import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { cachedJoin } from "@/lib/general/scopes/cached-join.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function handleJsonFile({
  baseDirectory,
  path,
  label,
  getDefaultValue,
}: {
  "baseDirectory"  : string;
  "path"           : Array<string>;
  "label"          : string;
  "getDefaultValue": () => Promise<unknown>;
}): Promise<unknown> {
  try {
    const filePath: string = cachedJoin(baseDirectory, ...path);

    log.debug(__PRE_BUNDLED_FILENAME__, `Checking if the '${label}' file exists`);
    const fileExists = await Host.files.exists(filePath);

    if (!fileExists) {
      log.warn(__PRE_BUNDLED_FILENAME__, `The '${label}' file does not exist`);
      log.debug(__PRE_BUNDLED_FILENAME__, `Getting the default value for '${label}'`);
      const defaultValue = await getDefaultValue();

      log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${label}' file`);
      await Host.files.writeText(
        filePath,
        JSON.stringify(
          defaultValue,
          null,
          2,
        ),
      );

      return defaultValue;
    }

    log.debug(__PRE_BUNDLED_FILENAME__, `Reading the '${label}' file`);
    const storedFileData: string = await Host.files.readText(filePath);
    let parsed: unknown;

    try {
      log.debug(__PRE_BUNDLED_FILENAME__, `Parsing the '${label}' file`);
      parsed = JSON.parse(storedFileData);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Could not parse the '${label}' file data:`,
        Errors.prettify(error),
      );
      log.debug(__PRE_BUNDLED_FILENAME__, `Returning the default value for '${label}'`);

      // No need to await here
      return getDefaultValue();
    }

    log.debug(__PRE_BUNDLED_FILENAME__, `Returning the parsed '${label}' file`);

    return parsed;
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not handle the '${label}' JSON file:`,
      Errors.prettify(error),
    );

    return getDefaultValue();
  }
}

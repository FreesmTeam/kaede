import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { FullValidationArgumentsType } from "@/types/schemas/validation-arguments.type.ts";

export function validate<T>({
  label,
  info,
  value,
  schema,
}: FullValidationArgumentsType): T | false {
  const entryInfo: string = info?.index === undefined
    ? `id: ${info?.id}`
    : `id: ${info?.id}; index: ${info.index}`;

  log.debug(__PRE_BUNDLED_FILENAME__, `Checking if the provided ${label} (${entryInfo}) is valid`);
  const validated: boolean = schema.Check(value);

  if (!validated) {
    /*
     * Producing detailed errors lazily loads the typebox runtime,
     * so the warning is logged as soon as they get figured out
     */
    schema
      .Errors(value)
      .then(errors => {
        log.warn(
          __PRE_BUNDLED_FILENAME__,
          `The provided ${label} (${entryInfo}) is not valid:`,
          "\n" + JSON.stringify(errors, null, 2),
        );
      })
      .catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          `Failed to produce the validation errors for the ${label} (${entryInfo}):`,
          Errors.prettify(error),
        );
      });

    return false;
  }

  return value as T;
}

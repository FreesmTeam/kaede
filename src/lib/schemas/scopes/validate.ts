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
    const errors: string = JSON.stringify(
      schema.Errors(value),
      null,
      2,
    );

    log.warn(
      __PRE_BUNDLED_FILENAME__,
      `The provided ${label} (${entryInfo}) is not valid:`,
      "\n" + errors,
    );

    return false;
  }

  return value as T;
}

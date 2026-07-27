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

import { log } from "@/lib/logging/scopes/log.ts";
import type { FullValidationArgumentsType } from "@/types/schemas/validation-arguments.type.ts";

async function logValidationErrors(
  label: string,
  entryInfo: string,
  value: unknown,
  schema: FullValidationArgumentsType["schema"],
): Promise<void> {
  try {
    const errors = await schema.Errors(value);

    log.warn(
      __PRE_BUNDLED_FILENAME__,
      `The provided ${label} (${entryInfo}) is not valid:`,
      "\n" + JSON.stringify(errors, null, 2),
    );
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to produce validation errors for ${label} (${entryInfo}):`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

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
  const isValid: boolean = schema.Check(value);

  if (!isValid) {
    void logValidationErrors(label, entryInfo, value, schema);

    return false;
  }

  return value as T;
}

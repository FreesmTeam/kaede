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

import { log } from "@/lib/logging/log.ts";
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
    schema
      .Errors(value)
      .then(error => {
        const errors: string = JSON.stringify(error, null, 2);

        log.error(
          __PRE_BUNDLED_FILENAME__,
          `The provided ${label} (${entryInfo}) is not valid:`,
          "\n" + errors,
        );
      });

    return false;
  }

  return value as T;
}

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

import type { TLocalizedValidationError } from "typebox/error";

import type {
  AccountSchema,
  ConfigSchema,
  ExtensionMetadataSchema,
  InstanceMetadataSchema,
  PatchMetaSchema,
} from "@/lib/schemas/scopes";

type SchemaType =
  typeof AccountSchema |
  typeof ConfigSchema |
  typeof ExtensionMetadataSchema |
  typeof InstanceMetadataSchema |
  typeof PatchMetaSchema;

/*
 * The validation checks are pre-compiled at build time
 * ('src/lib/schemas/generated/validators.ts'), so neither the typebox
 * runtime nor the schema definitions ship in the main bundle.
 *
 * Detailed errors are only needed when the validation fails, so we load them here
 */
const getSchema = async (key: string): Promise<SchemaType> => {
  const index = await import("@/lib/schemas/scopes");

  switch (key) {
    case "account": { return index.AccountSchema; }
    case "config": { return index.ConfigSchema; }
    case "extensionMetadata": { return index.ExtensionMetadataSchema; }
    case "instanceMetadata": { return index.InstanceMetadataSchema; }
    case "patchMeta": { return index.PatchMetaSchema; }
  }

  throw new Error("Not implemented lmao");
};

export async function getValidationErrors(
  key: string,
  value: unknown,
): Promise<Array<TLocalizedValidationError>> {
  const [{ Errors }, schema] = await Promise.all([
    import("typebox/value"),
    getSchema(key),
  ]);

  return Errors(schema, value);
}

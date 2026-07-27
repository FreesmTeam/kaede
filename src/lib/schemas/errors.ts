import type { TSchema } from "typebox";
import type { TLocalizedValidationError } from "typebox/error";

import type { ValidationSchemaKey } from "@/types/schemas/validation-arguments.type.ts";

async function selectSchema(
  key: ValidationSchemaKey,
): Promise<TSchema> {
  switch (key) {
    case "account": {
      const { AccountSchema } = await import("@/lib/schemas/scopes/accounts");

      return AccountSchema;
    }
    case "config": {
      const { ConfigSchema } = await import("@/lib/schemas/scopes/config");

      return ConfigSchema;
    }
    case "extensionMetadata": {
      const { ExtensionMetadataSchema } = await import("@/lib/schemas/scopes/extensions");

      return ExtensionMetadataSchema;
    }
    case "instanceMetadata": {
      const { InstanceMetadataSchema } = await import("@/lib/schemas/scopes/instances");

      return InstanceMetadataSchema;
    }
    case "patchMeta": {
      const { PatchMetaSchema } = await import("@/lib/schemas/scopes/meta");

      return PatchMetaSchema;
    }
  }
}

export async function getValidationErrors(
  key: ValidationSchemaKey,
  value: unknown,
): Promise<Array<TLocalizedValidationError>> {
  const [{ Errors }, schema] = await Promise.all([
    import("typebox/value"),
    selectSchema(key),
  ]);

  return Errors(schema, value);
}

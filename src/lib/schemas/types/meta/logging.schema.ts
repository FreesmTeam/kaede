import { Type } from "typebox";

import { AssetIndexSchema } from "@/lib/schemas/types/meta/asset-index.schema.ts";

export const LoggingSchema = Type.Object({
  "argument": Type.String(),
  "file"    : AssetIndexSchema,
  "type"    : Type.String(),
});

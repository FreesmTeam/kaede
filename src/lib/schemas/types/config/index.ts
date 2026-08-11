import { Type } from "typebox";

import { DevelopmentSchema } from "@/lib/schemas/types/config/development.schema.ts";
import { ExtensionsSchema } from "@/lib/schemas/types/config/extensions.schema.ts";
import { LogsSchema } from "@/lib/schemas/types/config/logs.schema.ts";
import { MinecraftSchema } from "@/lib/schemas/types/config/minecraft.schema.ts";
import { SelectedSchema } from "@/lib/schemas/types/config/selected.schema.ts";
import { UISchema } from "@/lib/schemas/types/config/ui.schema.ts";

export const ConfigSchema = Type.Object({
  "development": DevelopmentSchema,
  "extensions" : ExtensionsSchema,
  "ui"         : UISchema,
  "selected"   : SelectedSchema,
  "locale"     : Type.String(),
  "logs"       : LogsSchema,
  "java"       : Type.Array(Type.Object({
    "label": Type.String(),
    "path" : Type.String(),
  })),
  "minecraft": MinecraftSchema,
});

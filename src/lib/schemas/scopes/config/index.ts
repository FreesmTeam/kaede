import { Type } from "typebox";

import { DevelopmentSchema } from "@/lib/schemas/scopes/config/development.schema.ts";
import { ExtensionsSchema } from "@/lib/schemas/scopes/config/extensions.schema.ts";
import { LayoutSchema } from "@/lib/schemas/scopes/config/layout.schema.ts";
import { LogsSchema } from "@/lib/schemas/scopes/config/logs.schema.ts";
import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";
import { MiscSchema } from "@/lib/schemas/scopes/config/misc.schema.ts";

export const ConfigSchema = Type.Object({
  "development": DevelopmentSchema,
  "extensions" : ExtensionsSchema,
  "layout"     : LayoutSchema,
  "logs"       : LogsSchema,
  "minecraft"  : MinecraftSchema,
  "misc"       : MiscSchema,
});

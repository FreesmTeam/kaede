import { Type } from "typebox";

import { Patches } from "@/constants/meta.ts";
import { MinecraftSchema } from "@/lib/schemas/types/config/minecraft.schema.ts";
import { PatchUidSchema } from "@/lib/schemas/types/meta/patch-uid.schema.ts";

export const InstanceMetadataSchema = Type.Intersect([
  MinecraftSchema,
  Type.Object({
    "name"         : Type.String(),
    "checksum"     : Type.Boolean(),
    "lastLaunch"   : Type.Number(),
    "playTime"     : Type.Number(),
    // Initially used 'PatchUidSchema', but custom patches were not possible because of this
    "entry"        : Type.String(),
    "pinned"       : Type.Boolean(),
    "groups"       : Type.Array(Type.String()),
    "modpackPath"  : Type.Optional(Type.String()),
    "patchVersions": Type.Intersect([
      Type.Record(
        Type.Literal(Patches.Minecraft),
        Type.String(),
      ),
      Type.Partial(
        Type.Record(
          PatchUidSchema,
          Type.String(),
        ),
      ),
    ]),
  }),
]);

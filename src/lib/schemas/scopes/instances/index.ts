import { Type } from "typebox";

import { Patches } from "@/constants/meta.ts";
import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";
import { PatchUidSchema } from "@/lib/schemas/scopes/meta/patch-uid.schema.ts";

const MinecraftPatchVersionsSchema = Type.Record(
  Type.Literal(Patches.Minecraft),
  Type.String(),
);
const OptionalPatchVersionsSchema = Type.Partial(Type.Record(
  PatchUidSchema,
  Type.String(),
));
const PatchVersionsSchema = Type.Intersect([
  MinecraftPatchVersionsSchema,
  OptionalPatchVersionsSchema,
]);
const InstancePropertiesSchema = Type.Object({
  "name"         : Type.String(),
  "checksum"     : Type.Boolean(),
  "lastLaunch"   : Type.Number(),
  "playTime"     : Type.Number(),
  // Initially used 'PatchUidSchema', but custom patches were not possible because of this
  "entry"        : Type.String(),
  "pinned"       : Type.Boolean(),
  "groups"       : Type.Array(Type.String()),
  "patchVersions": PatchVersionsSchema,
});

export const InstanceMetadataSchema = Type.Intersect([
  MinecraftSchema,
  InstancePropertiesSchema,
]);

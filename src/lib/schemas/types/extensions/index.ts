import { Type } from "typebox";

import { PermissionsList } from "@/constants/permissions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export const ExtensionMetadataSchema = Type.Intersect([
  Type.Object({
    "id"  : Type.String(),
    "logo": Type.String(),
    "name": Type.String(),
    "type": Type.Union([
      Type.Literal("sandbox"),
      Type.Literal("unrestricted"),
    ]),
    "source"    : Type.String(),
    "version"   : Type.String(),
    "authors"   : Type.Array(Type.String()),
    "languages" : Type.Array(Type.String()),
    "categories": Type.Array(Type.String()),
  }),
  Type.Partial(Type.Object({
    "description": Type.Array(Type.String()),
    "permissions": Type.Array(
      Type.Union(
        PermissionsList.map((permission: PermissionType) => Type.Literal(permission)),
      ),
    ),
    "enabled": Type.Boolean(),
  })),
]);

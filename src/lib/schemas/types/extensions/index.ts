import { Type } from "typebox";

export const ExtensionMetadataSchema = Type.Intersect([
  Type.Object({
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
    "description": Type.String(),
    "permissions": Type.Array(Type.String()),
    "enabled"    : Type.Boolean(),
  })),
]);

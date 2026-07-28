import { Type } from "typebox";

export const AccountSchema = Type.Object({
  "msa": Type.Union([
    Type.Object({
      "token"       : Type.String(),
      "refreshToken": Type.String(),
    }),
    Type.Null(),
  ]),
  "profile": Type.Object({
    "uuid": Type.String(),
    "name": Type.String(),
    "type": Type.Union([
      Type.Literal("msa"),
      Type.Literal("offline"),
    ]),
  }),
  "skin": Type.Object({
    "id"     : Type.String(),
    "data"   : Type.String(),
    "url"    : Type.String(),
    "variant": Type.Union([
      Type.Literal("classic"),
      Type.Literal("slim"),
    ]),
  }),
});
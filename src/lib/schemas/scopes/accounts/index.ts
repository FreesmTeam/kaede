import { Type } from "typebox";

const MicrosoftAccountSchema = Type.Object({
  "token"       : Type.String(),
  "refreshToken": Type.String(),
});
const AccountTypeSchema = Type.Union([
  Type.Literal("msa"),
  Type.Literal("offline"),
]);
const AccountProfileSchema = Type.Object({
  "uuid": Type.String(),
  "name": Type.String(),
  "type": AccountTypeSchema,
});
const SkinVariantSchema = Type.Union([
  Type.Literal("classic"),
  Type.Literal("slim"),
]);
const AccountSkinSchema = Type.Object({
  "id"     : Type.String(),
  "data"   : Type.String(),
  "url"    : Type.String(),
  "variant": SkinVariantSchema,
});

export const AccountSchema = Type.Object({
  "msa": Type.Union([
    MicrosoftAccountSchema,
    Type.Null(),
  ]),
  "profile": AccountProfileSchema,
  "skin"   : AccountSkinSchema,
});

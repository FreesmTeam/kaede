import { Type } from "typebox";

export const ExtensionsSchema = Type.Object({
  "list": Type.Array(
    Type.Object({
      "enabled": Type.Boolean(),
      "id"     : Type.String(),
    }),
  ),
  "enabled"                   : Type.Boolean(),
  "allowUnrestrictedUntrusted": Type.Boolean(),
  "showAppAfterExtensionsLoad": Type.Boolean(),
});

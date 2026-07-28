import { Type } from "typebox";

export const RequireSchema = Type.Object({
  // Initially used 'PatchUidSchema', but custom patches were not possible because of this
  "uid"   : Type.String(),
  "equals": Type.Optional(
    Type.String(),
  ),
  "suggests": Type.Optional(
    Type.String(),
  ),
});

import { Type } from "typebox";

export const LogsSchema = Type.Object({
  "show"      : Type.Boolean(),
  "mode"      : Type.String(),
  "filtering" : Type.String(),
  "lineHeight": Type.Number(),
  "partsShown": Type.Object({
    "time"   : Type.Boolean(),
    "level"  : Type.Boolean(),
    "target" : Type.Boolean(),
    "message": Type.Boolean(),
  }),
  "partsSize": Type.Object({
    "time"   : Type.Number(),
    "level"  : Type.Number(),
    "target" : Type.Number(),
  }),
});

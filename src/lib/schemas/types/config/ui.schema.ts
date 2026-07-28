import { Type } from "typebox";

export const UISchema = Type.Object({
  "ripple": Type.Object({
    "color": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "sparkles": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
  "background": Type.Object({
    "image": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "blur": Type.Union([
      Type.Number(),
      Type.Null(),
    ]),
    "color": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "isVideo": Type.Union([
      Type.Boolean(),
      Type.Null(),
    ]),
    "key": Type.Union([
      Type.String(),
      Type.Number(),
      Type.Null(),
    ]),
  }),
  "text": Type.Object({
    "font": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "mainColor": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "secondaryColor": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
  "widget": Type.Object({
    "blur": Type.Union([
      Type.Number(),
      Type.Null(),
    ]),
    "textColor": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "secondaryColor": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "background": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
  "atAGlance": Type.Array(
    Type.Object({
      "title"   : Type.String(),
      "subtitle": Type.String(),
    }),
  ),
});

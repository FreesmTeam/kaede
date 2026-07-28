import { Type } from "typebox";

const LayoutStatisticSchema = Type.Union([
  Type.Literal("playtime"),
  Type.Literal("last-launch"),
]);
const NullableStringSchema = Type.Union([
  Type.String(),
  Type.Null(),
]);
const NullableNumberSchema = Type.Union([
  Type.Number(),
  Type.Null(),
]);
const BackgroundKeySchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Null(),
]);
const CustomLayoutSectionSchema = Type.Union([
  Type.Literal("sidebar"),
  Type.Literal("contextMenu"),
]);
const CustomLayoutSchema = Type.Union([
  Type.Boolean(),
  Type.Array(CustomLayoutSectionSchema),
]);
const BackgroundSchema = Type.Object({
  "url"    : NullableStringSchema,
  "key"    : BackgroundKeySchema,
  "blur"   : NullableNumberSchema,
  "color"  : NullableStringSchema,
  "isVideo": Type.Boolean(),
});
const SidebarSchema = Type.Object({
  "background": NullableStringSchema,
  "color"     : NullableStringSchema,
  "blur"      : NullableNumberSchema,
  "ripple"    : NullableStringSchema,
  "sparkles"  : NullableStringSchema,
});
const AtAGlanceSchema = Type.Object({
  "title"   : NullableStringSchema,
  "subtitle": NullableStringSchema,
});

export const LayoutSchema = Type.Object({
  "locale"                 : Type.String(),
  "stats"                  : LayoutStatisticSchema,
  "currentInstance"        : NullableStringSchema,
  "enableMaterialYouRipple": Type.Boolean(),
  "custom"                 : CustomLayoutSchema,
  "background"             : BackgroundSchema,
  "sidebar"                : SidebarSchema,
  "atAGlance"              : AtAGlanceSchema,
});

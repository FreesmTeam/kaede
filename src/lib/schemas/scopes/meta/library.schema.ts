import { Type } from "typebox";

export const ArtifactSchema = Type.Object({});
const LibraryDownloadsSchema = Type.Object({});
const LibraryExtractSchema = Type.Object({});
const LibraryNativesSchema = Type.Object({});
const LibraryRuleSchema = Type.Object({
  "action": Type.String(),
  "os"    : Type.Object({
    "name": Type.String(),
  }),
});
const OptionalLibrarySchema = Type.Partial(
  Type.Object({
    "downloads": LibraryDownloadsSchema,
    "extract"  : LibraryExtractSchema,
    "natives"  : LibraryNativesSchema,
    "rules"    : Type.Array(
      LibraryRuleSchema,
    ),
    "url"     : Type.String(),
    "MMC-hint": Type.String(),
  }),
);

export const LibrarySchema = Type.Intersect([
  Type.Object({
    "name": Type.String(),
  }),
  OptionalLibrarySchema,
]);

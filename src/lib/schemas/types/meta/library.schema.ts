import { Type } from "typebox";

export const ArtifactSchema = Type.Object({});
export const LibraryDownloadsSchema = Type.Object({});
export const LibraryExtractSchema = Type.Object({});
export const LibraryNativesSchema = Type.Object({});
export const LibraryRuleSchema = Type.Object({
  "action": Type.String(),
  "os"    : Type.Object({
    "name": Type.String(),
  }),
});

export const LibrarySchema = Type.Intersect([
  Type.Object({
    "name": Type.String(),
  }),
  Type.Partial(
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
  ),
]);

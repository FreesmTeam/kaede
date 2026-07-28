import { Type } from "typebox";

import { AssetIndexSchema } from "@/lib/schemas/types/meta/asset-index.schema.ts";
import { LibrarySchema } from "@/lib/schemas/types/meta/library.schema.ts";
import { LoggingSchema } from "@/lib/schemas/types/meta/logging.schema.ts";
import { MainJarSchema } from "@/lib/schemas/types/meta/main-jar.schema.ts";
import { RequireSchema } from "@/lib/schemas/types/meta/require.schema.ts";

/*
 * Validates only top-level and some nested fields
 * since I think that validating everything perfectly
 * according to the 'SpecificPatchMetaType' type
 * might backfire, because MultiMC meta server is literally not documented
 */
export const PatchMetaSchema = Type.Intersect([
  Type.Object({
    "formatVersion": Type.Number(),
    "name"         : Type.String(),
    // Initially used 'PatchUidSchema', but custom patches were not possible because of this
    "uid"          : Type.String(),
    "version"      : Type.String(),
  }),
  Type.Partial({
    // Initially was required, but some custom patches do not include the release time
    "releaseTime": Type.String(),
    "+libraries" : Type.Array(
      LibrarySchema,
    ),
    "+traits": Type.Array(
      Type.String(),
    ),
    "+tweakers": Type.Array(
      Type.String(),
    ),
    "assetIndex"          : AssetIndexSchema,
    "compatibleJavaMajors": Type.Array(
      Type.Number(),
    ),
    "compatibleJavaName": Type.String(),
    "conflicts"         : Type.Array(
      RequireSchema,
    ),
    "libraries": Type.Array(
      LibrarySchema,
    ),
    "logging"   : LoggingSchema,
    "mainClass" : Type.String(),
    "mainJar"   : MainJarSchema,
    "mavenFiles": Type.Array(
      LibrarySchema,
    ),
    "minecraftArguments": Type.String(),
    "order"             : Type.Number(),
    "requires"          : Type.Array(
      RequireSchema,
    ),
    "runtimes": Type.Array(
      Type.Object({}),
    ),
    "type"    : Type.String(),
    "volatile": Type.Boolean(),
  }),
]);

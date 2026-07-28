import { Type } from "typebox";

import { ArtifactSchema } from "@/lib/schemas/types/meta/library.schema.ts";

export const MainJarSchema = Type.Object({
  "downloads": Type.Object({
    "artifact": ArtifactSchema,
  }),
  "name": Type.String(),
});

import { Type } from "typebox";

import { PatchUIDs } from "@/constants/meta.ts";

export const PatchUidSchema = Type.Union(
  PatchUIDs.map(uid => Type.Literal(uid)),
);

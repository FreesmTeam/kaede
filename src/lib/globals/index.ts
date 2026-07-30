import { __registerComponent, __restoreComponent } from "@/extendable/component-registry.ts";
import { declareGlobals } from "@/lib/globals/scopes/declare-globals.ts";

export default {
  declareGlobals,
  "registerComponent": __registerComponent,
  "restoreComponent" : __restoreComponent,
} as const;

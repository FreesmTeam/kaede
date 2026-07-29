import { registerComponent } from "@/lib/globals/register-component.ts";
import { declareGlobals } from "@/lib/globals/scopes/declare-globals.ts";

export default {
  declareGlobals,
  registerComponent,
} as const;

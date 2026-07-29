import { declareGlobals } from "@/lib/globals/scopes/declare-globals.ts";
import { registerComponent } from "@/lib/globals/register-component.ts";

export default {
  declareGlobals,
  registerComponent,
} as const;

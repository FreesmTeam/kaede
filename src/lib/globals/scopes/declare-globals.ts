import Globals from "@/lib/globals";
import {
  declareGlobalsWithApi,
} from "@/lib/globals/scopes/declare-globals-core.ts";

export { revokeExtensionGlobals } from "@/lib/globals/scopes/declare-globals-core.ts";

export function declareGlobals(): void {
  declareGlobalsWithApi(Globals);
}

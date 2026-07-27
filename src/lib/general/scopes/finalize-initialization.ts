import General from "@/lib/general";
import {
  type FinalizeInitializationInput,
  finalizeInitializationWithDependencies,
} from "@/lib/general/scopes/finalize-initialization-core.ts";

export function finalizeInitialization(input: FinalizeInitializationInput): Promise<void> {
  return finalizeInitializationWithDependencies({
    "cachedJoin"  : (...paths): string => General.cachedJoin(...paths),
    "getJavaMajor": (): Promise<number> => General.getJavaMajor(),
  }, input);
}

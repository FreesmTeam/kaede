import { GlobalInternals } from "@/extendable/global-internals.ts";

export function getCachedPortable(): boolean {
  return GlobalInternals.portable;
}
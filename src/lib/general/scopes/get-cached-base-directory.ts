import { GlobalInternals } from "@/extendable/global-internals.ts";

export function getCachedBaseDirectory(): string {
  return GlobalInternals.baseDirectory;
}
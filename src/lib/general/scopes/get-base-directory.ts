import { GlobalInternals } from "@/extendable/global-internals.ts";

export function getBaseDirectory(): string {
  return GlobalInternals.baseDirectory;
}

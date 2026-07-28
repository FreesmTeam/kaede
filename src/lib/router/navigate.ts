import { globalStates } from "@/states/global.ts";
import type { RouteType } from "@/types/application/route.type.ts";

export function navigate(path: RouteType): void {
  globalStates.currentPage = path;
}

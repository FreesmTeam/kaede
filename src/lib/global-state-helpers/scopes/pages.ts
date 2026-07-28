import { Routes } from "@/constants/routes.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const getRouteFromSearchParameters = (searchParameters: URLSearchParams): RouteType => {
  const route: string | null = searchParameters.get("route");

  if (!route) {
    return Routes.Home;
  }

  for (const path of Object.values(Routes)) {
    if (route === path) {
      return path;
    }
  }

  return Routes.Home;
};

export const Pages = {
  getRouteFromSearchParameters,
};

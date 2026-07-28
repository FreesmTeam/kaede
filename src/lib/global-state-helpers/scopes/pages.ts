import { Routes } from "@/constants/routes.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const navigate = (path: RouteType): void => {
  const pages = GlobalObject.libs.GlobalStateHelpers.get().pages;

  GlobalObject.libs.GlobalStateHelpers.change("pages", {
    ...pages,
    "current": path,
  });
};
const getState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
): GlobalStatesType["pages"]["states"][Key] => {
  return GlobalObject.libs.GlobalStateHelpers.get().pages.states[key];
};
const getAllStates = (): GlobalStatesType["pages"]["states"] => {
  return GlobalObject.libs.GlobalStateHelpers.get().pages.states;
};
const addToState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = GlobalObject.libs.GlobalStateHelpers.get().pages;
  const newStates = { ...pages.states };

  newStates[key] = {
    ...newStates[key],
    ...value,
  };

  GlobalObject.libs.GlobalStateHelpers.change("pages", {
    ...pages,
    "states": newStates,
  });
};
const replaceState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = GlobalObject.libs.GlobalStateHelpers.get().pages;
  const newStates = { ...pages.states, [key]: value };

  GlobalObject.libs.GlobalStateHelpers.change("pages", {
    ...pages,
    "states": newStates,
  });
};
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
  navigate,
  getState,
  getAllStates,
  addToState,
  replaceState,
  getRouteFromSearchParameters,
};

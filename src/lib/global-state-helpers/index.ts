import { GlobalObject } from "@/extendable/global-object.ts";
import { changeGlobalState } from "@/lib/global-state-helpers/scopes/change-global-state.ts";
import {
  getConfigGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-config-global-states.ts";
import {
  getDefaultGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-default-global-states.ts";
import { Pages } from "@/lib/global-state-helpers/scopes/pages.ts";
import { getGlobalStates, globalStates } from "@/states/global.ts";
import type { RouteType } from "@/types/application/route.type.ts";

export default {
  "navigate": (path: RouteType): void => {
    globalStates.currentPage = path;
  },
  "showContextMenu": (event: MouseEvent): void => {
    GlobalObject.libs.ContextMenu.show(event);
  },
  "get"          : getGlobalStates,
  "change"       : changeGlobalState,
  "getFromConfig": getConfigGlobalStates,
  "getDefault"   : getDefaultGlobalStates,
  Pages,
} as const;

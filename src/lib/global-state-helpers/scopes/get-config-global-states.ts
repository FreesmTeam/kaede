import {
  ContextMenuItems,
  DefaultGlobalStatesPagesStates,
} from "@/constants/application.ts";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Configs from "@/lib/configs";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export function getConfigGlobalStates(): GlobalStatesType {
  const searchParameters = new URLSearchParams(location.search);

  const configFile: ConfigType = Configs.getCachedInitial();
  const portable: boolean = General.getCachedPortable();

  const portableVersion = portable ? "Portable" : "Non-portable";

  log.info(__PRE_BUNDLED_FILENAME__, `Running in the '${portableVersion}' version`);
  log.debug(__PRE_BUNDLED_FILENAME__, "Finishing 'getConfigGlobalStates' execution");

  return {
    ...configFile,
    "currentPage" : GlobalStateHelpers.Pages.getRouteFromSearchParameters(searchParameters),
    "translations": GlobalInternals.initialTranslations,
    "pages"       : DefaultGlobalStatesPagesStates,
    "sidebarItems": [
      ...SidebarRouteGroupItems.map(item => {
        return {
          "path"  : item.Path,
          "icon"  : item.Icon,
          "name"  : item.Path,
          "action": (): void => GlobalStateHelpers.Pages.navigate(item.Path),
        };
      }),
      "divider",
      {
        "path"  : Routes.AddInstance,
        "icon"  : "i-lucide-plus",
        "name"  : Routes.AddInstance,
        "action": (): void => GlobalStateHelpers.Pages.navigate(Routes.AddInstance),
      },
    ],
    "contextMenuItems": [...ContextMenuItems],
  };
}

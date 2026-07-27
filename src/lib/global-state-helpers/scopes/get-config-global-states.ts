import {
  ContextMenuItems,
  DefaultGlobalStatesPagesStates,
} from "@/constants/application.ts";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export function getConfigGlobalStates(): GlobalStatesType {
  const searchParameters = new URLSearchParams(location.search);

  const configFile: ConfigType = GlobalObject.libs.Configs.getCachedInitial();
  const isPortable: boolean = GlobalObject.libs.General.getCachedPortable();

  const portableVersion = isPortable ? "Portable" : "Non-portable";

  log.info(__PRE_BUNDLED_FILENAME__, `Running in the '${portableVersion}' version`);
  log.debug(__PRE_BUNDLED_FILENAME__, "Finishing 'getConfigGlobalStates' execution");

  return {
    ...configFile,
    "translations": GlobalInternals.initialTranslations,
    "pages"       : {
      "current": GlobalObject.libs.GlobalStateHelpers.Pages
        .getRouteFromSearchParameters(searchParameters),
      "states": DefaultGlobalStatesPagesStates,
    },
    "sidebarItems": [
      ...SidebarRouteGroupItems.map(item => {
        return {
          "path"  : item.Path,
          "icon"  : item.Icon,
          "name"  : item.Path,
          "action": (): void => GlobalObject.libs.GlobalStateHelpers.Pages.navigate(item.Path),
        };
      }),
      "divider",
      {
        "path"  : Routes.AddInstance,
        "icon"  : "i-lucide-plus",
        "name"  : Routes.AddInstance,
        "action": (): void => GlobalObject.libs.GlobalStateHelpers.Pages
          .navigate(Routes.AddInstance),
      },
    ],
    "contextMenuItems": [...ContextMenuItems],
  };
}

import { ContextMenuItems, DefaultGlobalStatesPagesStates } from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getDefaultGlobalStates(): GlobalStatesType {
  const searchParameters = new URLSearchParams(location.search);

  return {
    "translations": EnglishTranslations,
    "layout"      : {
      "locale"                 : "en",
      "stats"                  : "playtime",
      "currentInstance"        : null,
      "enableMaterialYouRipple": true,
      "custom"                 : false,
      "background"             : {
        "url"    : null,
        "key"    : null,
        "blur"   : null,
        "color"  : null,
        "isVideo": false,
      },
      "sidebar": {
        "blur"      : null,
        "color"     : null,
        "ripple"    : null,
        "sparkles"  : null,
        "background": null,
      },
      "atAGlance": {
        "title"   : null,
        "subtitle": null,
      },
    },
    "pages": {
      "current": GlobalObject.libs.GlobalStateHelpers.Pages
        .getRouteFromSearchParameters(searchParameters),
      "states": DefaultGlobalStatesPagesStates,
    },
    "logs": {
      "show"       : false,
      "lineBreaks" : false,
      "virtualized": false,
      "mode"       : "launcher",
      "filtering"  : "",
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
    "development"     : {
      "loadErudaDevTools"         : false,
      "showFPS"                   : false,
      "showCPUUsage"              : false,
      "showMemoryUsage"           : false,
      "enableDebugMode"           : false,
      "enableNativeContextMenu"   : false,
      "enableNativeReloadKeyBinds": false,
    },
    "extensions": {
      "enabled": true,
    },
    "misc": {
      "showAfterExtensionsInitialization": false,
      "autoConfigSync"                   : false,
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "icon"        : "",
      "javaBinary"  : "java",
      "add"         : {},
      "remove"      : {},
    },
  };
}

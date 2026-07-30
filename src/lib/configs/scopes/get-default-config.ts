import { DefaultLocale } from "@/constants/application.ts";
import Hooks from "@/lib/hooks";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getDefaultConfig(): Promise<ConfigType> {
  const hooksResult: "continue" | ConfigType | undefined =
    await Hooks.catchAsyncResponseHooks({
      "scope" : "onDefaultConfigGet",
      "toPass": undefined,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    return hooksResult;
  }

  return {
    "development": {
      "loadErudaDevTools"         : false,
      "showFPS"                   : false,
      "showCPUUsage"              : false,
      "showMemoryUsage"           : false,
      "enableDebugMode"           : false,
      "enableNativeContextMenu"   : false,
      "enableNativeReloadKeyBinds": false,
    },
    "extensions": {
      "list"                      : [],
      "permissions"               : {},
      "enabled"                   : true,
      "allowUnrestrictedUntrusted": true,
      "showAppAfterExtensionsLoad": false,
    },
    "ui": {
      "ripple": {
        "color"   : "#ffffff15",
        "sparkles": "255 255 255",
      },
      "background": {
        "image"  : null,
        "blur"   : null,
        "color"  : null,
        "isVideo": null,
        "key"    : null,
      },
      "text": {
        "font"          : null,
        "mainColor"     : null,
        "secondaryColor": null,
      },
      "widget": {
        "blur"          : null,
        "textColor"     : null,
        "secondaryColor": null,
        "background"    : null,
      },
      "atAGlance": [
        {
          "title"   : "A promising future",
          "subtitle": "without JavaScript",
        },
        {
          "title"   : "These messages",
          "subtitle": "were inspired by the \"At a Glance\" android widget",
        },
        {
          "title"   : "%date%",
          "subtitle": "What a great day to play Minecraft, right?",
        },
      ],
    },
    "selected": {
      "currentInstance": null,
      "stats"          : "playtime",
    },
    "locale": DefaultLocale,
    "logs"  : {
      "show"      : false,
      "mode"      : "launcher",
      "filtering" : "",
      "lineHeight": 20,
      "partsShown": { "time": true, "level": true, "target": true, "message": true },
      "partsSize" : { "time": 12, "level": 5, "target": 32 },
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

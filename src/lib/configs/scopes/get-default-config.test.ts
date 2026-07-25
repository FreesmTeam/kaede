import { expect, test } from "bun:test";

import type { ConfigType } from "@/types/configs/config.type.ts";

import { getDefaultConfig } from "./get-default-config.ts";

const testName = "Default Config: No arguments";

test(testName, async () => {
  const defaultConfig: ConfigType = {
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
      "enabled"                   : true,
      "allowUnrestrictedUntrusted": true,
    },
    "layout": {
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
        "background": null,
        "blur"      : null,
        "color"     : null,
        "ripple"    : null,
        "sparkles"  : null,
      },
      "atAGlance": {
        "title"   : null,
        "subtitle": null,
      },
    },
    "logs": {
      "show"       : false,
      "lineBreaks" : false,
      "virtualized": false,
      "mode"       : "launcher",
      "filtering"  : "",
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "icon"        : "",
      "javaBinary"  : "java",
      "add"         : {},
      "remove"      : {},
    },
    "misc": {
      "showAfterExtensionsInitialization": false,
      "autoConfigSync"                   : false,
    },
  };

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});

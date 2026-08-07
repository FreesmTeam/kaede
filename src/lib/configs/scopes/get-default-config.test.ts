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
      "useNativeColorPicker"      : false,
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
          "title"   : "Welcome~",
          "subtitle": "you can change this text",
        },
        {
          "title"   : "These messages",
          "subtitle": "were inspired by the \"At a Glance\" Android widget",
        },
        {
          "title"   : "%date%",
          "subtitle": "What a great day to play Minecraft, right?",
        },
      ],
    },
    "selected": {
      "account"        : 0,
      "currentInstance": null,
      "stats"          : "playtime",
    },
    "locale": "en",
    "logs"  : {
      "show"      : false,
      "mode"      : "kaede-launcher",
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

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});

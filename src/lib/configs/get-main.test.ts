/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { expect, mock, test } from "bun:test";

import type { ConfigType } from "@/types/configs/config.type.ts";

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
  "locale": "en",
  "logs"  : {
    "show"      : false,
    "mode"      : "launcher",
    "filtering" : "",
    "lineHeight": 20,
    "partsShown": { "time": true, "level": true, "target": true, "message": true },
    "partsSize" : { "time": 64, "level": 64, "target": 128 },
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

// 'handleJsonFile' returns the actually stored config; reassigned by every test case
let currentFetchedConfig: unknown;

/*
 * Unlike 'vi.mock', 'mock.module' is not hoisted, so it only has to be registered
 * before the dynamic import of the module under test. The factory closures read
 * 'currentFetchedConfig' at call time, which replaces the old 'vi.doMock' dance.
 *
 * Note: 'bun test' runs all test files in a single process with a shared module
 * registry, so these mocks leak into test files that run later. Tests that import
 * concrete scope files instead of the '@/lib/...' barrels stay unaffected.
 */
mock.module("@/lib/extensions-manager", () => ({
  "default": {
    "catchAsyncResponseHooks": async (): Promise<string> => "continue",
  },
}));
mock.module("@/lib/general", () => ({
  "default": {
    "handleJsonFile"        : async (): Promise<unknown> => currentFetchedConfig,
    "cachedJoin"            : (): string => "",
    "getCachedBaseDirectory": (): string => "",
  },
}));
mock.module("@/lib/configs/scopes/regenerate-config-file.ts", () => ({
  // 'regenerateConfigFile' returns a default config
  "regenerateConfigFile": async (): Promise<unknown> => defaultConfig,
}));

const tests: Array<{
  "arguments": {
    "fetchedConfig": unknown;
  };
  "output": unknown;
}> = [
  {
    "arguments": {
      "fetchedConfig": {},
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "ui": {
          ...defaultConfig.ui,
          "apparently": "extra fields are going to pass the validation. i " +
            "spent 2 days thinking why my tests were broken xd",
        },
        "TUYU": "is awesome",
      },
    },
    "output": {
      ...defaultConfig,
      "ui": {
        ...defaultConfig.ui,
        "apparently": "extra fields are going to pass the validation. i " +
          "spent 2 days thinking why my tests were broken xd",
      },
      "TUYU": "is awesome",
    },
  },
  {
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "layout": {

          /*
           * 'custom' field can only be a boolean
           * or an array of literals, such as "sidebar" or "contextMenu"
           */
          "custom": "blue",
        },
      },
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "minecraft": {
          // 'windowHeight' should have a 'number' type
          "windowHeight": "480",
          "windowWidth" : 854,
          "jvmArgs"     : "",
        },
      },
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "ui": {
          ...defaultConfig.ui,
          "background": {
            ...defaultConfig.ui.background,
            "image": "some-url",
          },
        },
      },
    },
    "output": {
      ...defaultConfig,
      "ui": {
        ...defaultConfig.ui,
        "background": {
          ...defaultConfig.ui.background,
          "image": "some-url",
        },
      },
    },
  },
  {
    "arguments": {
      "fetchedConfig": 0,
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "fetchedConfig": "",
    },
    "output": defaultConfig,
  },
];

test.each(tests)(
  "Get Config File: %o", async ({ "arguments": testArguments, output }) => {
    currentFetchedConfig = testArguments.fetchedConfig;

    // Imported dynamically so that the 'mock.module' calls above are registered first
    const { getMain } = await import("./get-main.ts");

    // For some reason, these 'expect' tests throw an error on test fail
    expect(
      JSON.stringify(await getMain()),
    ).toBe(
      JSON.stringify(output),
    );
  },
);

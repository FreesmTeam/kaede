import { expect, mock, test } from "bun:test";

import type { ConfigType } from "@/types/configs/config.type.ts";

const defaultConfig: ConfigType = {
  "development": null,
  "extensions" : {
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
        "layout": {
          ...defaultConfig.layout,
          "apparently": "extra fields are going to pass the validation. i " +
            "spent 2 days thinking why my tests were broken xd",
        },
        "TUYU": "is awesome",
      },
    },
    "output": {
      ...defaultConfig,
      "layout": {
        ...defaultConfig.layout,
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
        "layout": {
          ...defaultConfig.layout,
          "background": {
            ...defaultConfig.layout.background,
            "url": "some-url",
          },
        },
      },
    },
    "output": {
      ...defaultConfig,
      "layout": {
        ...defaultConfig.layout,
        "background": {
          ...defaultConfig.layout.background,
          "url": "some-url",
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
    const { getConfigFile } = await import("./get-config-file.ts");

    // For some reason, these 'expect' tests throw an error on test fail
    expect(
      JSON.stringify(await getConfigFile()),
    ).toBe(
      JSON.stringify(output),
    );
  },
);

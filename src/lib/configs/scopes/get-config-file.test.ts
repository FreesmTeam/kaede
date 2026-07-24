import { beforeEach, expect, test, vi } from "vitest";

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

vi.mock("@/lib/configs/scopes/get-default-config.ts", async () => {
  return {
    "getDefaultConfig": async (): Promise<ConfigType> => defaultConfig,
  };
});
vi.mock("@/lib/configs/scopes/initialize-config-file.ts", async () => {
  return {
    "initializeConfigFile": async (): Promise<void> => {},
  };
});

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

let index = -1;

beforeEach(() => {
  vi.doMock("@/lib/extensions-manager", async () => {
    return {
      "default": {
        "catchAsyncResponseHooks": async (): Promise<string> => "continue",
      },
    };
  });
  vi.doMock("@/lib/general", async () => {
    return {
      "default": {
        // 'handleJsonFile' returns actually stored config
        "handleJsonFile": async (): Promise<unknown> => tests[index].arguments.fetchedConfig,
        "cachedJoin"    : (): string => "",
      },
    };
  });
  vi.doMock("@/lib/configs/scopes/regenerate-config-file.ts", async () => {
    return {
      // 'regenerateConfigFile' returns a default config
      "regenerateConfigFile": async (): Promise<unknown> => defaultConfig,
    };
  });
});

test.for(tests)(
  "Get Config File: %o", async ({ output }) => {
    /*
     * Original import (top-level) will not be mocked, because 'vi.doMock' is evaluated
     * after all imports and 'vi.mock' can't be called dynamically
     */
    const { getConfigFile } = await import("./get-config-file.ts");

    index++;

    // For some reason, these 'expect' tests throw an error on test fail
    expect(
      JSON.stringify(await getConfigFile()),
    ).toBe(
      JSON.stringify(output),
    );
  },
);

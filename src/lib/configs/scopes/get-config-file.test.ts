import { beforeEach, expect, test, vi } from "vitest";

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
    "enabled": true,
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

vi.mock("@/lib/configs/scopes/get-default-config.ts", () => ({
  "getDefaultConfig": async (): Promise<ConfigType> => defaultConfig,
}));
vi.mock("@/lib/configs/scopes/initialize-config-file.ts", () => ({
  "initializeConfigFile": async (): Promise<void> => {},
}));
vi.mock("@/lib/logging/scopes/log.ts", () => ({
  "log": {
    "debug"    : vi.fn(),
    "info"     : vi.fn(),
    "warn"     : vi.fn(),
    "error"    : vi.fn(),
    "templates": {
      "json": {
        "contents": vi.fn((label: string) => label),
      },
    },
  },
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
          // 'custom' accepts only a boolean or an array of allowed literals.
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

const handleJsonFile = vi.fn<() => Promise<unknown>>();
const regenerateConfigFile = vi.fn(async (): Promise<ConfigType> => defaultConfig);

beforeEach(() => {
  handleJsonFile.mockReset();
  regenerateConfigFile.mockClear();
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
        handleJsonFile,
        "cachedJoin"            : (): string => "",
        "getCachedBaseDirectory": (): string => "/mock-root",
      },
    };
  });
  vi.doMock("@/lib/configs/scopes/regenerate-config-file.ts", async () => {
    return {
      // 'regenerateConfigFile' returns a default config
      regenerateConfigFile,
    };
  });
});

test.for(tests)(
  "Get Config File: %o", async ({ "arguments": testArguments, output }) => {
    handleJsonFile.mockResolvedValueOnce(testArguments.fetchedConfig);

    const { getConfigFile } = await import("./get-config-file.ts");

    // For some reason, these 'expect' tests throw an error on test fail
    expect(
      JSON.stringify(await getConfigFile()),
    ).toBe(
      JSON.stringify(output),
    );
  },
);

test("uses a loaded initial-state config without reading the file again", async () => {
  const loadedConfig = {
    ...defaultConfig,
    "TUYU": "is awesome",
  };
  const { getConfigFile } = await import("./get-config-file.ts");

  await expect(getConfigFile({
    "baseDirectory": "/launcher",
    "parsedFile"   : { "status": "loaded", "data": loadedConfig },
  })).resolves.toEqual(loadedConfig);
  expect(handleJsonFile).not.toHaveBeenCalled();
  expect(regenerateConfigFile).not.toHaveBeenCalled();
});

test("reads a missing initial-state config through the normal file path", async () => {
  handleJsonFile.mockResolvedValueOnce(defaultConfig);
  const { getConfigFile } = await import("./get-config-file.ts");

  await expect(getConfigFile({
    "baseDirectory": "/launcher",
    "parsedFile"   : { "status": "missing" },
  })).resolves.toEqual(defaultConfig);
  expect(handleJsonFile).toHaveBeenCalledOnce();
  expect(regenerateConfigFile).not.toHaveBeenCalled();
});

test("regenerates a corrupt initial-state config without parsing it again", async () => {
  const { getConfigFile } = await import("./get-config-file.ts");

  await expect(getConfigFile({
    "baseDirectory": "/launcher",
    "parsedFile"   : {
      "status": "corrupt",
      "raw"   : "{",
      "error" : "unexpected end of input",
    },
  })).resolves.toEqual(defaultConfig);
  expect(handleJsonFile).not.toHaveBeenCalled();
  expect(regenerateConfigFile).toHaveBeenCalledOnce();
});

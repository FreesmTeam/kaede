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

import { mock } from "bun:test";

import type { KaedeInternalsType, KaedeNamespaceType } from "./src/declarations";
import type { GlobalStatesType } from "./src/types/application/global-states.type";
import type { InstanceStatesType } from "./src/types/application/instance-states.type";
import type { AccountType } from "./src/types/configs/account.type";
import type { ConfigType } from "./src/types/configs/config.type";
import type { TranslationsType } from "./src/types/translations/translations.type";

(globalThis as unknown as Record<string, unknown>).__PRE_BUNDLED_FILENAME__ = "bun-test:0";

// Overwrite the 'window' object for tests only
const testWindow = {
  "__KAEDE_INTERNALS__": {
    "getGlobalStates"     : (): GlobalStatesType => ({} as GlobalStatesType),
    "changeGlobalStates"  : (): void => {},
    "getInstanceStates"   : (): InstanceStatesType => ({} as InstanceStatesType),
    "changeInstanceStates": (): void => {},
    "requestPermissions"  : async (): Promise<Array<boolean>> => ([]),
    "syncConfig"          : async (): Promise<void> => {},
    "joinDelimiter"       : "",
    "launcherVersion"     : "",
    "portable"            : false,
    "baseDirectory"       : "",
    "launchCount"         : 0,
    "initialConfig"       : {} as ConfigType,
    "temporaryAccounts"   : [] as Array<AccountType>,
    "initialTranslations" : {} as TranslationsType,
    "initialInstances"    : {} as InstanceStatesType,
    "serverProcesses"     : [],
    "logsInBrowser"       : [],
  },
  "__KAEDE__": {
    "hooks": {
      "onConfigFileGet"              : { "before": [], "after": [] },
      "onDefaultConfigGet"           : { "before": [] },
      "onPagesChange"                : { "before": [], "after": [] },
      "onLayoutChange"               : { "before": [], "after": [] },
      "onLogsChange"                 : { "before": [], "after": [] },
      "onSidebarItemsChange"         : { "before": [], "after": [] },
      "onContextMenuItemsChange"     : { "before": [], "after": [] },
      "onDevelopmentChange"          : { "before": [], "after": [] },
      "onMiscChange"                 : { "before": [], "after": [] },
      "onMinecraftChange"            : { "before": [], "after": [] },
      "onTranslationsChange"         : { "before": [], "after": [] },
      "onExtensionsChange"           : { "before": [], "after": [] },
      "onInstanceChange"             : { "before": [], "after": [] },
      "onPreLaunchInformation"       : { "before": [], "after": [] },
      "onVersionMeta"                : { "before": [], "after": [] },
      "onLibrariesParsing"           : { "before": [], "after": [] },
      "onMinecraftAssetsGet"         : { "before": [], "after": [] },
      "onMinecraftPatchesGet"        : { "before": [], "after": [] },
      "onMinecraftClientGet"         : { "before": [], "after": [] },
      "onMinecraftLoggingGet"        : { "before": [], "after": [] },
      "onMinecraftLibrariesGet"      : { "before": [], "after": [] },
      "onNativesExtract"             : { "before": [], "after": [] },
      "onJavaBinaryGet"              : { "before": [] },
      "onJVMArgumentsGet"            : { "before": [], "after": [] },
      "onClassPathsGet"              : { "before": [] },
      "onGameArgumentsGet"           : { "before": [], "after": [] },
      "onAdditionalStartArgumentsGet": { "before": [] },
      "onLaunchArgumentsReplace"     : { "before": [], "after": [] },
      "onMinecraftLaunch"            : { "before": [], "after": [] },
      "onMinecraftKill"              : { "before": [], "after": [] },
      "onMinecraftPatchResolve"      : { "before": [], "after": [] },
    },
  },
} satisfies {
  "__KAEDE_INTERNALS__": KaedeInternalsType;

  /*
   * Kaede itself uses only the "hooks" property.
   * The remaining fields provide access to the Kaede utilities for plugin developers.
   */
  "__KAEDE__": Pick<
    KaedeNamespaceType,
    "hooks"
  >;
};

(globalThis as unknown as { "window": unknown }).window = testWindow;

// @ts-expect-error top-level await works
const logMock = await import("./src/__mocks__/log.cjs");
// @ts-expect-error top-level await works
const windowMock = await import("./src/__mocks__/api/window.cjs");

// Mock the logging utilities
mock.module("@/lib/logging/scopes/log.ts", () => logMock);

// Mock Tauri APIs
mock.module("@tauri-apps/api/window", () => windowMock);

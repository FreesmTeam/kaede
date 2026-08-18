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

import { markRaw, type Reactive, reactive } from "vue";

import {
  ActionKeys,
  ContextMenuItems,
  DefaultGlobalStatesPagesStates,
} from "@/constants/application.ts";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Router from "@/lib/router";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

/**
 * Contains all global application states.
 * Will be overwritten in 'main.ts' once the global states are ready
 */
export let globalStates: Reactive<GlobalStatesType>;

/**
 * Assign the actual global states to 'globalStates'.
 * This function is called in 'main.ts'
 */
export function declareGlobalStates(): void {
  /*
   * Since global states are deeply reactive,
   * we should copy the original config object to avoid its changes
   */
  const configFile: ConfigType = structuredClone(GlobalInternals.initialConfig);
  const customSettings = DefaultGlobalStatesPagesStates["add-instance"].customSettings;

  globalStates = reactive<GlobalStatesType>({
    ...configFile,
    "contextMenuItems": markRaw(ContextMenuItems),
    "currentPage"     : Router.getInitialPage(),
    "translations"    : markRaw(GlobalInternals.initialTranslations),
    "pages"           : {
      ...DefaultGlobalStatesPagesStates,
      "add-instance": {
        ...DefaultGlobalStatesPagesStates["add-instance"],
        "customSettings": markRaw(customSettings ?? []),
      },
    },
    "sidebarItems": markRaw([
      ...SidebarRouteGroupItems.map(item => {
        return {
          "path"  : item.Path,
          "icon"  : item.Icon,
          "name"  : item.Path,
          "action": ActionKeys.SidebarRouteChange,
        };
      }),
      "divider",
      {
        "path"  : Routes.AddInstance,
        "icon"  : "i-lucide-plus",
        "name"  : Routes.AddInstance,
        "action": ActionKeys.SidebarRouteChange,
      },
    ]),
  });
}

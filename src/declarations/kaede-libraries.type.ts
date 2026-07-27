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

import type Browser from "@/lib/browser";
import type Configs from "@/lib/configs";
import type DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import type Errors from "@/lib/errors";
import type ExtensionsManager from "@/lib/extensions-manager";
import type General from "@/lib/general";
import type GlobalStateHelpers from "@/lib/global-state-helpers";
import type Globals from "@/lib/globals";
import type Instances from "@/lib/instances";
import type Launcher from "@/lib/launcher";
import type Logging from "@/lib/logging";
import type Schemas from "@/lib/schemas";
import type Txiki from "@/lib/txiki";
import type { RouteType } from "@/types/application/route.type.ts";

export type KaedeLibrariesType = {

  /**
   * A support for the Browser environment (non-application)
   */
  "Browser": typeof Browser;

  /**
   * Launcher configuration-related collection of utilities
   */
  "Configs": typeof Configs;

  /**
   * Launcher development mode related collection of utilities
   */
  "DevelopmentModeHelpers": typeof DevelopmentModeHelpers;

  /**
   * Launcher errors-related collection of utilities
   */
  "Errors": typeof Errors;

  /**
   * Launcher extension system related collection of utilities
   */
  "ExtensionsManager": typeof ExtensionsManager;

  /**
   * Launcher general-purpose collection of utilities
   */
  "General": typeof General;

  /**
   * Launcher global states related collection of utilities
   */
  "GlobalStateHelpers": typeof GlobalStateHelpers;

  /**
   * Launcher 'window' object related collection of utilities
   */
  "Globals": typeof Globals;

  /**
   * Launcher Minecraft instances related collection of utilities
   */
  "Instances": typeof Instances;

  /**
   * Launcher Minecraft-related collection of utilities
   */
  "Launcher": typeof Launcher;

  /**
   * Launcher logging-related collection of utilities
   */
  "Logging": typeof Logging;

  /**
   * Launcher collection of typebox validation schemas
   */
  "Schemas": typeof Schemas;

  /**
   * Launcher utils for extensions to conveniently run txiki.js servers
   */
  "Txiki": typeof Txiki;

  /**
   * Launcher context menu related collection of utilities
   */
  "ContextMenu": {

    /*
     * Shows context menu. Requires the 'MouseEvent' typed event
     * as the argument, since the context menu dynamically calculates
     * its absolute position in the DOM by reading the provided event
     */
    "show" : (event: MouseEvent) => void;
    // Hides context menu
    "close": () => void;
  };

  /**
   * Launcher pages-related collection of utilities
   */
  "Pages": {
  // Teleports the specified page to an element with the provided selector
    "mount"  : (page: Exclude<RouteType, "none">, id: string) => void;
    // Removes the specified page from DOM
    "unmount": (page: Exclude<RouteType, "none">) => void;
  };
};

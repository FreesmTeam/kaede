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

import type { KaedeConstantsType } from "@/declarations/kaede-constants.type.ts";
import type { KaedeHooksType } from "@/declarations/kaede-hooks.type.ts";
import type { KaedeLibrariesType } from "@/declarations/kaede-libraries.type.ts";
import type { KaedeVariablesType } from "@/declarations/kaede-variables.type.ts";

export type KaedeNamespaceSurfaceType = {

  /**
   * Exposed packages.
   *
   * Used for externalizing plugin dependencies.
   * Contains only Vue 3 as of now.
   */
  "packages": Record<string, unknown>;

  /**
   * Global constants.
   *
   * Changing any field of the listed objects
   * will alter behaviour of that field for everyone.
   *
   * Example:
   *
   * ```ts
   * // Inside a trusted plugin.
   * // This assignment changes the config filename for everyone,
   * // meaning that now the config file will be stored
   * // under 'config.json5' instead of 'config.json'
   * scopedThis.Kaede.constants.FileStructure.Files.Config = "config.json5";
   * ```
   */
  "constants": KaedeConstantsType;

  /**
   * Global utilities.
   *
   * Changing any field of the listed objects
   * will alter behaviour of that field for everyone.
   *
   * Example:
   *
   * ```ts
   * // Somewhere in a plugin
   * const arrayInADifferentScope: Array<unknown> = [];
   *
   * function customDebugFunction(...input: Array<unknown>): void {
   *   arrayInADifferentScope.push(input);
   * };
   *
   * // This assignment overwrites the 'debug' field in the 'log' object
   * // with a reference to the 'customDebugFunction' function,
   * // so all upcoming 'log#debug' calls will use the 'customDebugFunction' function
   * // even if calls were not made through the explicit trusted context
   * scopedThis.Kaede.libs.Logging.log.debug = customDebugFunction;
   * ```
   */
  "libs": KaedeLibrariesType;

  /**
   * Global variables that are allowed to be changed by plugins
   */
  "variables": KaedeVariablesType;

  /**
   * Application hooks
   */
  "hooks": KaedeHooksType;
};

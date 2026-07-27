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

import type _Application from "@/constants/application.ts";
import type _ASCIIArt from "@/constants/ascii-art.ts";
import type _Browser from "@/constants/browser.ts";
import type _EventListeners from "@/constants/event-listeners.ts";
import type _FileStructure from "@/constants/file-structure.ts";
import type _Hooks from "@/constants/hooks.ts";
import type _Launcher from "@/constants/launcher.ts";
import type _Meta from "@/constants/meta.ts";
import type _Permissions from "@/constants/permissions.ts";
import type _Routes from "@/constants/routes.ts";

export type KaedeConstantsType = {

  /**
   * Application constants
   */
  "Application": typeof _Application;

  /**
   * Includes a default ASCII art generator
   */
  "ASCIIArt": typeof _ASCIIArt;

  /**
   * Constants related to the 'Browser' lib in 'libs' (non-application)
   */
  "Browser": typeof _Browser;

  /**
   * Event listeners for the sandboxed plugins
   */
  "EventListeners": typeof _EventListeners;

  /**
   * Launcher file structure
   */
  "FileStructure": typeof _FileStructure;

  /**
   * Useful objects for the extension system hooks
   */
  "Hooks": typeof _Hooks;

  /**
   * Minecraft launch related constants
   */
  "Launcher": typeof _Launcher;

  /**
   * Launcher meta related constants
   */
  "Meta": typeof _Meta;

  /**
   * Useful objects for the sandboxed permission system
   */
  "Permissions": typeof _Permissions;

  /**
   * Constants related to the application pages
   */
  "Routes": typeof _Routes;
};

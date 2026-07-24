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

/* eslint-disable max-lines */
import type * as TauriOAuth2 from "@fabianlars/tauri-plugin-oauth";
import type * as TauriApi from "@tauri-apps/api";
import type * as TauriClipboard from "@tauri-apps/plugin-clipboard-manager";
import type * as TauriDialog from "@tauri-apps/plugin-dialog";
import type * as TauriFs from "@tauri-apps/plugin-fs";
import type * as TauriHttp from "@tauri-apps/plugin-http";
import type * as TauriNotification from "@tauri-apps/plugin-notification";
import type * as TauriOpener from "@tauri-apps/plugin-opener";
import type * as TauriOs from "@tauri-apps/plugin-os";
import type * as TauriProcess from "@tauri-apps/plugin-process";
import type * as TauriUpload from "@tauri-apps/plugin-upload";
import type { App } from "vue";

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
import type {
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStatesChangerType,
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  ArgumentAuthReplacementsType,
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { AtAGlanceType } from "@/types/misc/at-a-glance.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

/* Expand the globals with Kaede and Tauri namespaces */
declare global {

  /* This variable is replaced to the source code file name at build time */
  const __PRE_BUNDLED_FILENAME__: string;

  /* Declared in the '@/lib/globals/scopes/declare-window.ts' */
  interface Window {

    /* Tauri internals */
    "__TAURI_INTERNALS__": object;

    /* Tauri exposes these */
    "__TAURI__": typeof TauriApi & {
      "dialog"          : typeof TauriDialog;
      "clipboardManager": typeof TauriClipboard;
      "fs"              : typeof TauriFs;
      "http"            : typeof TauriHttp;
      "notification"    : typeof TauriNotification;
      "opener"          : typeof TauriOpener;
      "os"              : typeof TauriOs;
      "process"         : typeof TauriProcess;
      "upload"          : typeof TauriUpload;
    };

    /* Tauri community plugins */
    "__TAURI_PLUGINS_COMMUNITY__": {
      "oauth2": typeof TauriOAuth2;
      "shell" : object;
    };

    /**
     * Workarounds for application internals.
     *
     * These fields are generally not intended to be modified by extensions
     */
    "__KAEDE_INTERNALS__": {
      // Gets current application global states (use 'libs.GlobalStateHelpers#get')
      "getGlobalStates"     : () => GlobalStatesType;
      // Changes application global states (use 'libs.GlobalStateHelpers#change')
      "changeGlobalStates"  : GlobalStatesChangerType;
      // Gets current application instance states (use 'libs.Instances#get')
      "getInstanceStates"   : () => InstanceStatesType;
      // Changes application instance states (use 'libs.Instances#change')
      "changeInstanceStates": InstanceStatesChangerType;
      // Requests plugin permissions from user
      "requestPermissions"  : (
        permissions: Array<PermissionType>,
        extension: string
      ) => Promise<Array<boolean>>;
      // Syncs the config file using global states
      "syncConfig"          : () => Promise<void>;
      // Platform-specific delimiter obtained by a single invoke of Tauri 'join'
      "joinDelimiter"       : string;
      // Launcher version
      "launcherVersion"     : string;
      // Config state before launcher initialization
      "initialConfig"       : ConfigType;
      // Accounts state before launcher initialization
      "temporaryAccounts"   : Array<AccountType>;
      // Translations state before launcher initialization
      "initialTranslations" : TranslationsType;
      // Instances metadata state before launcher initialization
      "initialInstances"    : InstanceStatesType;
      // Portable state
      "portable"            : boolean;
      // Base directory
      "baseDirectory"       : string;
      // This counter starts as 0 and increases by 1 each time the UI is reloaded via window#reload
      "launchCount"         : number;
      // A temporary storage for the 'At a Glance' widget
      "atAGlance"          ?: AtAGlanceType;
      // A timestamp for the application code initialization
      "startTime"          ?: number;
      // A Java major version (for example, 8, 11, or 17)
      "javaMajor"          ?: number;
      "appInstance"        ?: App<Element>;

      /* Needed for browser environments (non-application) */
      "logsInBrowser"       : Array<string>;
      "indexedDB"          ?: IDBDatabase;

      /* Stores the server processes */
      "serverProcesses"     : Array<{
        "name" : string;
        "port" : number;
        "value": {
          "pid"  : number;
          "kill" : () => Promise<void>;
          "write": (data: string | Uint8Array | number[]) => Promise<void>;
        };
      }>;
    };

    /**
     * Application namespace.
     *
     * Extensions can extend this namespace
     */
    "__KAEDE__": {

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
       * // Somewhere in a plugin.
       * // This assignment changes the config filename for everyone,
       * // meaning that now the config file will be stored
       * // under 'config.json5' instead of 'config.json'
       * window.__KAEDE__.libs.FileStructure.Files.Config = "config.json5";
       * ```
       */
      "constants": {

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
       * // even if calls were not made via accessing the 'window' object
       * window.__KAEDE__.libs.Logging.log.debug = customDebugFunction;
       * ```
       */
      "libs": {

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

      /**
       * Global variables that are allowed to be changed by plugins
       */
      "variables": {
        // Applies a background color to the ripple effect
        "rippleColor"     : string;
        // Applies a sparkles color to the ripple effect
        "sparklesColorRGB": string;
        // Logs-related variables
        "logs"            : {
          // Whether to shorten the target string in logs
          "targetCollapse"       : boolean;
          // The number of characters to display in the shortened form of target
          "collapsedTargetLength": number;
        };
      };

      /**
       * Application hooks
       */
      "hooks": {

        /**
         * Executed on the config retrieve
         */
        "onConfigFileGet": {

          /**
           * Executes 'async' or 'sync' functions before the config was read.
           *
           * @param input - a string that represents absolute pathname of the config file
           *                is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           *                 in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<string, ConfigType>;

          /**
           * Executes 'async' or 'sync' functions after the config was read, parsed, and validated.
           *
           * @param input - an object that has the 'ConfigType' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * it may add properties to the passed config argument or do nothing.
           */
          "after": HookReturnType<ConfigType, ConfigType>;
        };

        /**
         * Executed on the default config retrieve
         */
        "onDefaultConfigGet": {

          /**
           * Executes 'async' or 'sync' functions before the default config was returned.
           *
           * No arguments.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<unknown, ConfigType>;
        };

        /**
         * Executed on the translations replacement in global states
         */
        "onTranslationsChange": {

          /**
           * Executes 'sync'-only functions before the 'translations' property
           * in the global states will change.
           *
           * @param input - an object that has the 'TranslationsType' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'TranslationsType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<TranslationsType, TranslationsType, "non-promise">;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'translations' property in the global states has changed.
           *
           * @param input - an object that has the 'TranslationsType' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<TranslationsType, "nothing">;
        };

        /**
         * Executed on the 'layout' field replacement in global states
         */
        "onLayoutChange": {

          /**
           * Executes 'sync'-only functions before the 'layout' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["layout"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["layout"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["layout"],
            GlobalStatesType["layout"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'layout' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["layout"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["layout"], "nothing">;
        };

        /**
         * Executed on the 'pages' field replacement in global states
         */
        "onPagesChange": {

          /**
           * Executes 'sync'-only functions before the 'pages' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["pages"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["pages"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["pages"],
            GlobalStatesType["pages"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'pages' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["pages"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["pages"], "nothing">;
        };

        /**
         * Executed on the 'logs' field replacement in global states
         */
        "onLogsChange": {

          /**
           * Executes 'sync'-only functions before the 'logs' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["logs"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["logs"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["logs"],
            GlobalStatesType["logs"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'logs' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["logs"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["logs"], "nothing">;
        };

        /**
         * Executed on the 'sidebarItems' field replacement in global states
         */
        "onSidebarItemsChange": {

          /**
           * Executes 'sync'-only functions before the 'sidebarItems' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["sidebarItems"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["sidebarItems"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["sidebarItems"],
            GlobalStatesType["sidebarItems"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'sidebarItems' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["sidebarItems"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["sidebarItems"], "nothing">;
        };

        /**
         * Executed on the 'contextMenuItems' field replacement in global states
         */
        "onContextMenuItemsChange": {

          /**
           * Executes 'sync'-only functions before the 'contextMenuItems' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["contextMenuItems"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["contextMenuItems"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["contextMenuItems"],
            GlobalStatesType["contextMenuItems"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'contextMenuItems' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["contextMenuItems"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["contextMenuItems"], "nothing">;
        };

        /**
         * Executed on the 'development' field replacement in global states
         */
        "onDevelopmentChange": {

          /**
           * Executes 'sync'-only functions before the 'development' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["development"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["development"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["development"],
            GlobalStatesType["development"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'development' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["development"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["development"], "nothing">;
        };

        /**
         * Executed on the 'misc' field replacement in global states
         */
        "onMiscChange": {

          /**
           * Executes 'sync'-only functions before the 'misc' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["misc"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["misc"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["misc"],
            GlobalStatesType["misc"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'misc' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["misc"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["misc"], "nothing">;
        };

        /**
         * Executed on the 'minecraft' field replacement in global states
         */
        "onMinecraftChange": {

          /**
           * Executes 'sync'-only functions before the 'minecraft' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["minecraft"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["minecraft"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["minecraft"],
            GlobalStatesType["minecraft"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'minecraft' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["minecraft"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["minecraft"], "nothing">;
        };

        /**
         * Executed on the 'extensions' field replacement in global states
         */
        "onExtensionsChange": {

          /**
           * Executes 'sync'-only functions before the 'extensions' property
           * in the global states will change.
           *
           * @param input - an object that has the 'GlobalStatesType["extensions"]' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'GlobalStatesType["extensions"]' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["extensions"],
            GlobalStatesType["extensions"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'extensions' property in the global states has changed.
           *
           * @param input - an object that has the 'GlobalStatesType["extensions"]' type
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["extensions"], "nothing">;
        };

        /**
         * Executed on the field addition/overwrite/deletion in instance states
         */
        "onInstanceChange": {

          /**
           * Executes 'sync'-only functions before the provided field
           * in the instance states will change.
           *
           * @param input - an object that has the 'key' and 'value' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'key' and 'value' fields
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            { "key": string; "value": InstanceStateType },
            { "key": string; "value": InstanceStateType },
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the provided field in the instance states has changed.
           *
           * @param input - an object that has the 'key' and 'value' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            { "key": string; "value": InstanceStateType },
            "nothing"
          >;
        };

        /**
         * Executed in the very beginning of the instance launch
         */
        "onPreLaunchInformation": {

          /**
           * Executes 'sync'-only functions before any information reads.
           *
           * @param input - an object that has the 'statuses' and 'instanceId' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'PreLaunchInformationType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            { "statuses": LauncherStatusesType; "instanceId": string },
            PreLaunchInformationType | false,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions after all necessary information
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'PreLaunchInformationType | false' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'PreLaunchInformationType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            PreLaunchInformationType | false,
            PreLaunchInformationType | false,
            "non-promise"
          >;
        };

        /**
         * Executed on libraries and natives parsing
         */
        "onLibrariesParsing": {

          /**
           * Executes 'sync'-only functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'libraries' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<SpecificPatchLibraryType>;
            },
            Array<MappedArtifactType>,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions after all libraries and natives are parsed.
           *
           * @param input - an object that has the 'necessaries', 'unparsed',
           * and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "unparsed"   : Array<SpecificPatchLibraryType>;
              "parsed"     : Array<MappedArtifactType>;
            },
            Array<MappedArtifactType>,
            "non-promise"
          >;
        };

        /**
         * Executed on version meta get
         */
        "onVersionMeta": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'PreLaunchInformationType' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            PreLaunchInformationType,
            SpecificPatchMetaType | false
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft version meta
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'minecraftVersionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries"         : PreLaunchInformationType;
              "minecraftVersionMeta": SpecificPatchMetaType | false;
            },
            SpecificPatchMetaType | false
          >;
        };

        /**
         * Executed on minecraft assets downloading/verifying
         */
        "onMinecraftAssetsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a boolean (where 'true' is success and 'false' is fail)
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            boolean
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft version meta
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a boolean (where 'true' is success and 'false' is fail)
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            boolean
          >;
        };

        /**
         * Executed on prism launcher patches downloading/verifying
         */
        "onMinecraftPatchesGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * or 'false' in case of a fail
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            Array<MappedArtifactType> | false
          >;

          /**
           * Executes 'async' or 'sync' functions after the prism launcher patches
           * were handled. If the handling fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'results',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * or 'false' in case of a fail
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "results"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            Array<MappedArtifactType> | false
          >;
        };

        /**
         * Executed on minecraft main jar downloading/verifying
         */
        "onMinecraftClientGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'client',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "client"     : MappedArtifactType;
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft main jar
           * was downloaded/validated. If the download/validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'client',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "client"     : MappedArtifactType;
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft logging downloading/verifying
         */
        "onMinecraftLoggingGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'logging',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "logging"    : MappedArtifactType & {
                "argument": string;
              };
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft logging config
           * was downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'logging',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "logging"    : MappedArtifactType & {
                "argument": string;
              };
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft libraries downloading/verifying
         */
        "onMinecraftLibrariesGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'libraries',
           * 'natives', and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<MappedArtifactType>;
              "natives"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft libraries were
           * downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'libraries',
           * 'natives', and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<MappedArtifactType>;
              "natives"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft natives extraction
         */
        "onNativesExtract": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'paths' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "paths"      : Array<string>;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft libraries were
           * downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'paths' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "paths"      : Array<string>;
            },
            "nothing"
          >;
        };

        /**
         * Executed on a shell command name get
         */
        "onJavaBinaryGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the shell command name
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            string
          >;
        };

        /**
         * Executed on JVM arguments get
         */
        "onJVMArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'jvmArguments', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;

          /**
           * Executes 'async' or 'sync' functions after the JVM arguments were collected.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on classpaths get
         */
        "onClassPathsGet": {

          /**
           * Executes 'async' or 'sync' functions right after
           * acquiring merged library, native, and main jar paths.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'mergedPaths', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the argument string and classpaths string
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "mergedPaths": Array<string>;
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
            },
            {
              "argument"  : string;
              "classPaths": string;
            }
          >;
        };

        /**
         * Executed on game arguments get
         */
        "onGameArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the game arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
            },
            string
          >;

          /**
           * Executes 'async' or 'sync' functions after the MultiMC tweakers were added.
           *
           * @param input - an object that has the 'argumentsWithTweakers', 'instanceId',
           * 'necessaries', 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the game arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "argumentsWithTweakers": Array<string>;
              "instanceId"           : string;
              "necessaries"          : PreLaunchInformationType;
              "versionMeta"          : SpecificPatchMetaType;
              "parsed"               : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on additional start arguments get.
         * For example, '/C javaw' for the 'cmd' command
         */
        "onAdditionalStartArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'javaBinary', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents additional commands before JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on argument placeholders replace in the launch command
         */
        "onLaunchArgumentsReplace": {

          /**
           * Executes 'sync'-only functions before making a regex replacements (no auth)
           *
           * @param input - an object that has the 'auth', 'replacements', 'builtLaunchArguments',
           * 'instanceId', 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the final launch command
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "auth": {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
              };
              "replacements"        : ArgumentReplacementsType;
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            string,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions before making an auth regex replacements,
           * but after the non-auth regex replacements
           *
           * @param input - an object that has the 'auth', 'authReplacements',
           * 'replacements', 'builtLaunchArguments', 'instanceId',
           * 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the final launch command
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "auth": {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
              };
              "replacements"        : ArgumentReplacementsType;
              "authReplacements"    : ArgumentAuthReplacementsType;
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            string,
            "non-promise"
          >;
        };

        /**
         * Executed on minecraft instance launch
         */
        "onMinecraftLaunch": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'command', 'auth',
           * 'builtLaunchArguments', 'instanceId', 'necessaries',
           * 'parsed', 'versionMeta', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              // [javaBinary, launchCommand]
              "command": [string, string];
              "auth"   : {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
              };
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft instance was launched.
           *
           * @param input - an object that has the 'process', 'command', 'auth',
           * 'builtLaunchArguments', 'instanceId', 'necessaries',
           * 'parsed', 'versionMeta', and 'javaBinary' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "process": {
                "pid"  : number;
                "kill" : () => Promise<void>;
                "write": (data: string | Uint8Array | number[]) => Promise<void>;
              };
              // [javaBinary, launchCommand]
              "command": [string, string];
              "auth"   : {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
              };
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft instance kill
         */
        "onMinecraftKill": {

          /**
           * Executes 'async' or 'sync' functions before the instance was killed.
           *
           * @param input - an object that has the 'pid' and 'kill' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "pid" : number;
              "kill": () => Promise<void>;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the instance was killed.
           *
           * @param input - an instance process id number
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            number,
            "nothing"
          >;
        };
        "onMinecraftPatchResolve": {
          "before": [];
          "after" : [];
        };
      };
    };
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = Window["__KAEDE__"];
export type KaedeInternalsType = Window["__KAEDE_INTERNALS__"];
